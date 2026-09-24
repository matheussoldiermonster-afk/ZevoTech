const { z } = require('zod');
const prisma = require('../prismaClient');
const { parsePagination, paginate } = require('../lib/pagination');
const v = require('../lib/validators');
const { parseDateOnly, addDays, todayCivil } = require('../lib/dates');
const { effectiveStatus, effectiveStatusWhere } = require('../services/financeService');
const { notFound } = require('../lib/httpError');

const updateSchema = z.object({
  status: v.paymentStatus.optional(),
  method: v.paymentMethod.nullable().optional(),
  paidAt: v.nullableDateOnly(),
  dueDate: v.dateOnly().optional(),
  amount: v.money().optional(),
  notes: v.nullableText(2000),
});

const INCLUDE = {
  contract: {
    select: {
      id: true,
      periodicity: true,
      client: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
  },
};

const SORT_MAP = {
  dueDate: (o) => ({ dueDate: o }),
  reference: (o) => ({ reference: o }),
  amount: (o) => ({ amount: o }),
  paidAt: (o) => ({ paidAt: { sort: o, nulls: 'last' } }),
  client: (o) => ({ contract: { client: { name: o } } }),
};

function withEffectiveStatus(payment, today) {
  return { ...payment, status: effectiveStatus(payment.status, payment.dueDate, today) };
}

async function list(req, res, next) {
  try {
    const p = parsePagination(req.query, { sortMap: SORT_MAP, defaultSort: 'dueDate' });
    const q = req.query;
    const and = [];
    const status = v.enumFilter(v.paymentStatus, q.status);
    if (status) and.push(effectiveStatusWhere(status));
    if (q.contractId) and.push({ contractId: v.uuidFilter(q.contractId) });
    if (q.clientId) and.push({ contract: { clientId: v.uuidFilter(q.clientId) } });
    if (q.companyId) and.push({ contract: { companyId: v.uuidFilter(q.companyId) } });
    const from = parseDateOnly(q.from);
    const to = parseDateOnly(q.to);
    if (from) and.push({ dueDate: { gte: from } });
    if (to) and.push({ dueDate: { lt: addDays(to, 1) } });
    if (p.search) {
      const contains = { contains: p.search, mode: 'insensitive' };
      and.push({ OR: [{ contract: { client: { name: contains } } }, { contract: { company: { name: contains } } }] });
    }

    const today = todayCivil();
    const result = await paginate(
      prisma,
      prisma.monthlyPayment,
      { where: and.length ? { AND: and } : {}, include: INCLUDE },
      p
    );
    if (Array.isArray(result)) return res.json(result.map((r) => withEffectiveStatus(r, today)));
    return res.json({ ...result, data: result.data.map((r) => withEffectiveStatus(r, today)) });
  } catch (err) {
    return next(err);
  }
}

/** Mantido por compatibilidade. Totais gerais por status efetivo. */
async function summary(req, res, next) {
  try {
    const agg = (where) => prisma.monthlyPayment.aggregate({ where, _sum: { amount: true }, _count: true });
    const [pending, paid, overdue] = await Promise.all([
      agg(effectiveStatusWhere('PENDING')),
      agg({ status: 'PAID' }),
      agg(effectiveStatusWhere('OVERDUE')),
    ]);
    const fmt = (a) => ({ total: Number(a._sum.amount || 0), count: a._count });
    return res.json({ pending: fmt(pending), paid: fmt(paid), overdue: fmt(overdue) });
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = updateSchema.parse(req.body);
    const current = await prisma.monthlyPayment.findUnique({ where: { id: req.params.id } });
    if (!current) throw notFound('Cobrança não encontrada.');

    const updateData = { ...data };
    const nextStatus = data.status || current.status;
    if (nextStatus === 'PAID') {
      // Data informada = dia civil; gravamos 12:00 de Brasília (15:00 UTC).
      updateData.paidAt = data.paidAt
        ? new Date(data.paidAt.getTime() + 15 * 3600000)
        : current.paidAt || new Date();
    } else {
      // Correção: ao desfazer o pagamento, a data de pagamento é limpa.
      updateData.paidAt = null;
    }

    const payment = await prisma.monthlyPayment.update({
      where: { id: current.id },
      data: updateData,
      include: INCLUDE,
    });
    return res.json(withEffectiveStatus(payment, todayCivil()));
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, summary, update };
