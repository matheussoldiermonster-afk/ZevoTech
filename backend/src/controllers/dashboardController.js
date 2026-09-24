/**
 * Dashboard — resumo legado (/api/dashboard/summary).
 * Mantido para a tela atual. No Lote 2 o Dashboard novo passa a usar
 * endpoints separados por card (KPIs, série, operação, equipamentos, alertas).
 *
 * Correções desta versão:
 *  - Mês calculado no fuso da empresa (antes deslocava um mês inteiro se o
 *    servidor rodasse em horário de Brasília).
 *  - Faturamento inclui as cobranças avulsas de OS, não só as de contrato.
 *  - "Hoje" da agenda usa a data civil de Brasília.
 */
const prisma = require('../prismaClient');
const { todayCivil, addDays, currentMonth, parseMonth, shiftMonth, monthRange, formatMonth } = require('../lib/dates');
const { monthSummary } = require('../services/financeService');
const { badRequest } = require('../lib/httpError');

const typeLabels = {
  INSTALLATION: 'Instalação',
  CORRECTIVE: 'Corretiva',
  PREVENTIVE: 'Preventiva',
  KIT_REMOVAL: 'Retirada de Kit',
  OTHER: 'Outro',
};

async function billingThisMonth() {
  const s = await monthSummary(currentMonth());
  return { total: s.expected, received: s.received, pending: s.open };
}

async function scheduleToday() {
  const today = todayCivil();
  const schedules = await prisma.schedule.findMany({
    where: {
      date: { gte: today, lt: addDays(today, 1) },
      serviceOrder: { status: { not: 'CANCELLED' } },
    },
    include: {
      serviceOrder: {
        select: {
          type: true,
          client: { select: { name: true } },
          company: { select: { name: true } },
        },
      },
    },
    orderBy: [{ time: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  });

  return schedules.map((s) => ({
    time: s.time || '—',
    type: typeLabels[s.serviceOrder.type] || s.serviceOrder.type,
    clientName: s.serviceOrder.client.name,
    companyName: s.serviceOrder.company?.name,
  }));
}

async function stockSummary() {
  const [types, grouped] = await Promise.all([
    prisma.equipmentType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.equipment.groupBy({ by: ['equipmentTypeId'], where: { status: 'IN_STOCK' }, _sum: { quantity: true } }),
  ]);
  const inStock = new Map(grouped.map((g) => [g.equipmentTypeId, g._sum.quantity || 0]));

  const items = types.map((t) => {
    const quantity = inStock.get(t.id) || 0;
    return { name: t.name, quantity, belowMinimum: t.minimumStock > 0 && quantity < t.minimumStock };
  });
  return { items, lowStockCount: items.filter((i) => i.belowMinimum).length };
}

async function companiesSummary() {
  const [activeClients, equipmentInstalled, activeContracts] = await Promise.all([
    prisma.client.count({ where: { active: true } }),
    prisma.equipment.aggregate({ where: { status: 'INSTALLED' }, _sum: { quantity: true } }),
    prisma.contract.aggregate({ where: { status: 'ACTIVE' }, _sum: { monthlyValue: true } }),
  ]);

  return {
    active: activeClients,
    equipmentInstalled: equipmentInstalled._sum.quantity || 0,
    recurringRevenue: Number(activeContracts._sum.monthlyValue || 0),
  };
}

async function summary(req, res, next) {
  try {
    const [billing, schedule, stock, companies] = await Promise.all([
      billingThisMonth(),
      scheduleToday(),
      stockSummary(),
      companiesSummary(),
    ]);
    return res.json({ billing, schedule, stock, companies });
  } catch (err) {
    return next(err);
  }
}

// ===========================================================================
// Dashboard gerencial (v3) — um endpoint por bloco, carregados em paralelo
// ===========================================================================

function monthFromQuery(query) {
  if (!query.month) return currentMonth();
  const ref = parseMonth(query.month);
  if (!ref) throw badRequest('Mês inválido. Use o formato AAAA-MM.');
  return ref;
}

/** Variação percentual; null quando não há base de comparação. */
function change(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** GET /api/dashboard/kpis?month=AAAA-MM */
async function kpis(req, res, next) {
  try {
    const ref = monthFromQuery(req.query);
    const prev = shiftMonth(ref, -1);
    const r = monthRange(ref);
    const rp = monthRange(prev);

    const [cur, old, activeClients, newClients, newClientsPrev, recurring] = await Promise.all([
      monthSummary(ref),
      monthSummary(prev),
      prisma.client.count({ where: { active: true } }),
      prisma.client.count({ where: { createdAt: { gte: r.instantStart, lt: r.instantEnd } } }),
      prisma.client.count({ where: { createdAt: { gte: rp.instantStart, lt: rp.instantEnd } } }),
      prisma.contract.aggregate({ where: { status: 'ACTIVE' }, _sum: { monthlyValue: true }, _count: true }),
    ]);

    return res.json({
      month: formatMonth(ref),
      billing: { value: cur.expected, previous: old.expected, change: change(cur.expected, old.expected), count: cur.expectedCount },
      received: { value: cur.received, previous: old.received, change: change(cur.received, old.received), count: cur.receivedCount },
      open: { value: cur.open, previous: old.open, change: change(cur.open, old.open), overdueCount: cur.overdueCount },
      clients: { active: activeClients, newInMonth: newClients, newPrevious: newClientsPrev },
      recurringRevenue: { value: Number(recurring._sum.monthlyValue || 0), contracts: recurring._count },
    });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/dashboard/operations?month=AAAA-MM */
async function operations(req, res, next) {
  try {
    const ref = monthFromQuery(req.query);
    const r = monthRange(ref);
    const inMonth = { gte: r.instantStart, lt: r.instantEnd };
    const today = todayCivil();
    const weekStart = addDays(today, -((today.getUTCDay() + 6) % 7));

    const [open, inProgress, urgent, completed, cancelled, createdByType, todaySchedules] = await Promise.all([
      prisma.serviceOrder.count({ where: { status: 'OPEN' } }),
      prisma.serviceOrder.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.serviceOrder.count({ where: { priority: 'URGENT', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.serviceOrder.count({ where: { status: 'COMPLETED', completedAt: inMonth } }),
      prisma.serviceOrder.count({
        where: {
          status: 'CANCELLED',
          history: { some: { toStatus: 'CANCELLED', action: { not: 'MIGRATED' }, createdAt: inMonth } },
        },
      }),
      prisma.serviceOrder.groupBy({ by: ['type'], where: { createdAt: inMonth }, _count: { _all: true } }),
      prisma.schedule.count({
        where: { date: { gte: today, lt: addDays(today, 1) }, serviceOrder: { status: { not: 'CANCELLED' } } },
      }),
    ]);

    const createdTotal = createdByType.reduce((a, g) => a + g._count._all, 0);
    const byType = ['INSTALLATION', 'CORRECTIVE', 'PREVENTIVE', 'KIT_REMOVAL', 'OTHER'].map((type) => {
      const count = createdByType.find((g) => g.type === type)?._count._all || 0;
      return { type, label: typeLabels[type], count, percent: createdTotal ? Math.round((count / createdTotal) * 1000) / 10 : 0 };
    });

    return res.json({
      month: formatMonth(ref),
      status: { open, inProgress, completed, cancelled },
      urgent,
      createdInMonth: createdTotal,
      byType,
      todaySchedules,
      weekStart: weekStart.toISOString().slice(0, 10),
    });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/dashboard/equipment */
async function equipment(req, res, next) {
  try {
    const [byStatus, types, stockGroups] = await Promise.all([
      prisma.equipment.groupBy({ by: ['status'], _sum: { quantity: true } }),
      prisma.equipmentType.findMany({
        where: { active: true, minimumStock: { gt: 0 } },
        select: { id: true, name: true, minimumStock: true },
        orderBy: { name: 'asc' },
      }),
      prisma.equipment.groupBy({ by: ['equipmentTypeId'], where: { status: 'IN_STOCK' }, _sum: { quantity: true } }),
    ]);
    // Quantidade de UNIDADES (cada registro pode representar várias)
    const count = (s) => byStatus.find((g) => g.status === s)?._sum.quantity || 0;
    const stock = new Map(stockGroups.map((g) => [g.equipmentTypeId, g._sum.quantity || 0]));
    const belowMinimum = types
      .map((t) => ({ id: t.id, name: t.name, minimumStock: t.minimumStock, inStock: stock.get(t.id) || 0 }))
      .filter((t) => t.inStock < t.minimumStock);

    return res.json({
      available: count('IN_STOCK'),
      installed: count('INSTALLED'),
      maintenance: count('MAINTENANCE'),
      damaged: count('DAMAGED'),
      belowMinimum,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { summary, kpis, operations, equipment };
