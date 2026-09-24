const { z } = require('zod');
const prisma = require('../prismaClient');
const { parsePagination, paginate, parseBool } = require('../lib/pagination');
const v = require('../lib/validators');
const { parseMonth, parseDateOnly, currentMonth } = require('../lib/dates');
const { chargeAmount, checkBillingReference, activeFromStatus } = require('../lib/contractRules');
const { resolveLocation } = require('../services/locationService');
const { badRequest, notFound, conflict } = require('../lib/httpError');

const contractSchema = z.object({
  clientId: v.uuid().optional(),
  companyId: v.nullableUuid(),
  addressId: v.nullableUuid(),
  monthlyValue: z.coerce.number().positive('O valor mensal deve ser maior que zero.').max(99999999.99),
  periodicity: v.contractPeriodicity.optional(),
  status: v.contractStatus.optional(),
  dueDay: z.coerce.number().int().min(1).max(31),
  startDate: v.dateOnly(),
  endDate: v.nullableDateOnly(),
  notes: v.nullableText(2000),
  active: z.boolean().optional(), // LEGADO
});

const INCLUDE = {
  client: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  address: { select: { id: true, label: true, street: true, number: true, city: true } },
  _count: { select: { monthlyPayments: true } },
};

const SORT_MAP = {
  createdAt: (o) => ({ createdAt: o }),
  monthlyValue: (o) => ({ monthlyValue: o }),
  dueDay: (o) => ({ dueDay: o }),
  startDate: (o) => ({ startDate: o }),
  client: (o) => ({ client: { name: o } }),
};

/** Mantém status (novo) e active (legado) coerentes. */
function syncStatusFields(data) {
  if (data.status) {
    data.active = activeFromStatus(data.status);
  } else if (data.active !== undefined) {
    data.status = data.active ? 'ACTIVE' : 'CANCELLED';
  }
  return data;
}

function validateDates(data) {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw badRequest('A data de término deve ser posterior à data de início.');
  }
}

async function list(req, res, next) {
  try {
    const p = parsePagination(req.query, { sortMap: SORT_MAP, defaultSort: 'createdAt', defaultOrder: 'desc' });
    const active = parseBool(req.query.active);
    const status = v.enumListFilter(v.contractStatus, req.query.status);
    const contains = p.search ? { contains: p.search, mode: 'insensitive' } : undefined;

    const where = {
      clientId: req.query.clientId ? v.uuidFilter(req.query.clientId) : undefined,
      companyId: req.query.companyId ? v.uuidFilter(req.query.companyId) : undefined,
      active,
      status: status ? { in: status } : undefined,
      OR: contains ? [{ client: { name: contains } }, { company: { name: contains } }, { notes: contains }] : undefined,
    };

    return res.json(await paginate(prisma, prisma.contract, { where, include: INCLUDE }, p));
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        company: true,
        address: true,
        monthlyPayments: { orderBy: { dueDate: 'desc' } },
      },
    });
    if (!contract) throw notFound('Contrato não encontrado.');
    return res.json(contract);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = syncStatusFields(contractSchema.parse(req.body));
    validateDates(data);
    const contract = await prisma.$transaction(async (tx) => {
      const location = await resolveLocation(tx, data, { requireAddress: false });
      return tx.contract.create({
        data: { ...data, ...location },
        include: INCLUDE,
      });
    });
    return res.status(201).json(contract);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = syncStatusFields(contractSchema.partial().parse(req.body));
    const contract = await prisma.$transaction(async (tx) => {
      const current = await tx.contract.findUnique({ where: { id: req.params.id } });
      if (!current) throw notFound('Contrato não encontrado.');
      validateDates({ startDate: data.startDate || current.startDate, endDate: data.endDate !== undefined ? data.endDate : current.endDate });

      const locationChanged =
        (data.clientId && data.clientId !== current.clientId) ||
        (data.companyId && data.companyId !== current.companyId) ||
        (data.addressId !== undefined && data.addressId !== current.addressId);
      if (locationChanged) {
        const clientChanged = data.clientId && data.clientId !== current.clientId;
        const location = await resolveLocation(
          tx,
          {
            clientId: data.clientId || (data.companyId ? undefined : current.clientId),
            companyId: data.companyId || (clientChanged ? null : current.companyId),
            addressId: data.addressId !== undefined ? data.addressId : clientChanged ? null : current.addressId,
          },
          { requireAddress: false }
        );
        Object.assign(data, location);
      }
      return tx.contract.update({ where: { id: current.id }, data, include: INCLUDE });
    });
    return res.json(contract);
  } catch (err) {
    return next(err);
  }
}

/**
 * Gera a cobrança de uma referência (mês) respeitando a periodicidade.
 * Corpo: { reference: "2026-09" } (também aceita "2026-09-01" ou ISO).
 */
async function generateMonthlyPayment(req, res, next) {
  try {
    const raw = req.body?.reference;
    let ref = parseMonth(raw);
    if (!ref && raw) {
      const d = parseDateOnly(raw);
      if (d) ref = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    }
    if (!ref && !raw) ref = currentMonth();
    if (!ref) throw badRequest('Referência inválida. Use o formato AAAA-MM.');

    const contract = await prisma.contract.findUnique({ where: { id: req.params.id } });
    if (!contract) throw notFound('Contrato não encontrado.');

    const check = checkBillingReference(contract, ref);
    if (!check.ok) throw badRequest(check.reason);

    const reference = new Date(Date.UTC(ref.year, ref.month - 1, 1));
    try {
      const payment = await prisma.monthlyPayment.create({
        data: {
          contractId: contract.id,
          reference,
          amount: chargeAmount(contract.monthlyValue, contract.periodicity),
          dueDate: check.dueDate,
        },
      });
      return res.status(201).json(payment);
    } catch (err) {
      if (err.code === 'P2002') throw conflict('Já existe cobrança gerada para esse mês.');
      throw err;
    }
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await prisma.contract.update({
      where: { id: req.params.id },
      data: { active: false, status: 'CANCELLED' },
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

/**
 * Gera, de uma vez, as cobranças de uma referência para TODOS os contratos ativos
 * que devem cobrar naquele mês (respeitando início, término e periodicidade).
 * Idempotente: cobranças já existentes são mantidas e contadas à parte.
 * Corpo: { reference: "2026-09" } (padrão: mês atual)
 */
async function generateBatch(req, res, next) {
  try {
    const raw = req.body?.reference;
    const ref = raw ? parseMonth(raw) : currentMonth();
    if (!ref) throw badRequest('Referência inválida. Use o formato AAAA-MM.');
    const reference = new Date(Date.UTC(ref.year, ref.month - 1, 1));

    const contracts = await prisma.contract.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        status: true,
        periodicity: true,
        startDate: true,
        endDate: true,
        dueDay: true,
        monthlyValue: true,
        monthlyPayments: { where: { reference }, select: { id: true } },
      },
    });

    const toCreate = [];
    let alreadyExisted = 0;
    let notInCycle = 0;
    for (const c of contracts) {
      if (c.monthlyPayments.length) {
        alreadyExisted += 1;
        continue;
      }
      const check = checkBillingReference(c, ref);
      if (!check.ok) {
        notInCycle += 1;
        continue;
      }
      toCreate.push({
        contractId: c.id,
        reference,
        amount: chargeAmount(c.monthlyValue, c.periodicity),
        dueDate: check.dueDate,
      });
    }

    // skipDuplicates protege contra duas gerações simultâneas (índice único contrato+referência)
    const result = toCreate.length
      ? await prisma.monthlyPayment.createMany({ data: toCreate, skipDuplicates: true })
      : { count: 0 };

    return res.status(201).json({
      reference: `${ref.year}-${String(ref.month).padStart(2, '0')}`,
      activeContracts: contracts.length,
      created: result.count,
      totalAmount: Math.round(toCreate.reduce((sum, p) => sum + p.amount, 0) * 100) / 100,
      alreadyExisted: alreadyExisted + (toCreate.length - result.count),
      notInCycle,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getById, create, update, generateMonthlyPayment, generateBatch, remove };
