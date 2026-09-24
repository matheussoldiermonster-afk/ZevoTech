const { parsePagination } = require('../lib/pagination');
const v = require('../lib/validators');
const { parseDateOnly, parseMonth, currentMonth, shiftMonth, civilRangeToInstants } = require('../lib/dates');
const { z } = require('zod');
const prisma = require('../prismaClient');
const finance = require('../services/financeService');
const { badRequest } = require('../lib/httpError');

const SORTS = { dueDate: 1, amount: 1, clientName: 1, companyName: 1, status: 1, paidAt: 1 };

/**
 * GET /api/finance/receivables — contratos + OS avulsas em uma única lista paginada.
 * ?page&pageSize&sort&order&search&status=OVERDUE,PENDING&source=CONTRACT|SERVICE_ORDER
 * &clientId&companyId&addressId&contractId&serviceOrderId&dueFrom&dueTo&paidFrom&paidTo
 */
async function receivables(req, res, next) {
  try {
    const q = req.query;
    const p = parsePagination(q, {});
    const paidFrom = parseDateOnly(q.paidFrom);
    const paidTo = parseDateOnly(q.paidTo);

    const result = await finance.listReceivables({
      page: p.page,
      pageSize: p.pageSize,
      skip: p.skip,
      take: p.take,
      search: p.search,
      sort: SORTS[q.sort] ? q.sort : 'dueDate',
      order: q.order === 'desc' ? 'desc' : 'asc',
      status: v.enumListFilter(v.paymentStatus, q.status),
      source: ['CONTRACT', 'SERVICE_ORDER'].includes(q.source) ? q.source : undefined,
      clientId: q.clientId ? v.uuidFilter(q.clientId) : undefined,
      companyId: q.companyId ? v.uuidFilter(q.companyId) : undefined,
      addressId: q.addressId ? v.uuidFilter(q.addressId) : undefined,
      contractId: q.contractId ? v.uuidFilter(q.contractId) : undefined,
      serviceOrderId: q.serviceOrderId ? v.uuidFilter(q.serviceOrderId) : undefined,
      dueFrom: parseDateOnly(q.dueFrom) || undefined,
      dueTo: parseDateOnly(q.dueTo) || undefined,
      paidFrom: paidFrom ? civilRangeToInstants(paidFrom, paidFrom).instantStart : undefined,
      paidTo: paidTo ? civilRangeToInstants(paidTo, paidTo).instantEnd : undefined,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/finance/summary?month=2026-09 */
async function summary(req, res, next) {
  try {
    const ref = req.query.month ? parseMonth(req.query.month) : currentMonth();
    if (!ref) throw badRequest('Mês inválido. Use o formato AAAA-MM.');
    return res.json(await finance.monthSummary(ref));
  } catch (err) {
    return next(err);
  }
}

/** GET /api/finance/series?from=2026-04&to=2026-09 (padrão: últimos 6 meses; máx. 36) */
async function series(req, res, next) {
  try {
    const to = req.query.to ? parseMonth(req.query.to) : currentMonth();
    const from = req.query.from ? parseMonth(req.query.from) : to && shiftMonth(to, -5);
    if (!from || !to) throw badRequest('Período inválido. Use o formato AAAA-MM.');
    const span = (to.year - from.year) * 12 + (to.month - from.month);
    if (span < 0) throw badRequest('O mês inicial deve ser anterior ao final.');
    if (span > 35) throw badRequest('O período máximo é de 36 meses.');
    return res.json(await finance.monthlySeries(from, to));
  } catch (err) {
    return next(err);
  }
}

const batchPaySchema = z.object({
  items: z
    .array(z.object({ source: z.enum(['CONTRACT', 'SERVICE_ORDER']), id: v.uuid() }))
    .min(1, 'Selecione ao menos uma cobrança.')
    .max(200, 'Selecione no máximo 200 cobranças por vez.'),
  paidAt: v.nullableDateOnly(),
  method: v.paymentMethod.nullable().optional(),
});

/**
 * POST /api/finance/receivables/pay — registra o pagamento de várias cobranças
 * (contratos e/ou OS) em uma única transação. Cobranças já pagas ou canceladas
 * são ignoradas e informadas na resposta.
 */
async function payBatch(req, res, next) {
  try {
    const data = batchPaySchema.parse(req.body);
    // Data informada = dia civil; gravamos 12:00 de Brasília (15:00 UTC), como nos demais pagamentos.
    const paidAt = data.paidAt ? new Date(data.paidAt.getTime() + 15 * 3600000) : new Date();
    const userId = req.user?.sub || null;
    const contractIds = data.items.filter((i) => i.source === 'CONTRACT').map((i) => i.id);
    const orderIds = data.items.filter((i) => i.source === 'SERVICE_ORDER').map((i) => i.id);
    const payable = { in: ['PENDING', 'OVERDUE'] };

    const result = await prisma.$transaction(async (tx) => {
      const mp = contractIds.length
        ? await tx.monthlyPayment.updateMany({
            where: { id: { in: contractIds }, status: payable },
            data: { status: 'PAID', paidAt, method: data.method ?? undefined },
          })
        : { count: 0 };

      let osCount = 0;
      if (orderIds.length) {
        const orders = await tx.serviceOrder.findMany({
          where: { id: { in: orderIds }, paymentStatus: payable, totalValue: { gt: 0 }, status: { not: 'CANCELLED' } },
          select: { id: true, paymentStatus: true },
        });
        for (const o of orders) {
          await tx.serviceOrder.update({
            where: { id: o.id },
            data: {
              paymentStatus: 'PAID',
              paidAt,
              paymentMethod: data.method ?? undefined,
              history: {
                create: { action: 'PAYMENT_UPDATED', note: `Pagamento: ${o.paymentStatus} → PAID (em lote)`, userId },
              },
            },
          });
        }
        osCount = orders.length;
      }
      return mp.count + osCount;
    });

    return res.json({ paid: result, skipped: data.items.length - result });
  } catch (err) {
    return next(err);
  }
}

module.exports = { receivables, summary, series, payBatch };
