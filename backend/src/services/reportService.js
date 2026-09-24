/**
 * Relatório mensal gerencial — montagem dos dados.
 * Usado pela tela de Relatórios (JSON) e pelas exportações em PDF e Excel,
 * para que os três mostrem exatamente os mesmos números.
 */
const prisma = require('../prismaClient');
const { monthRange, shiftMonth, formatMonth } = require('../lib/dates');
const finance = require('./financeService');

const TYPE_LABELS = {
  INSTALLATION: 'Instalação',
  CORRECTIVE: 'Corretiva',
  PREVENTIVE: 'Preventiva',
  KIT_REMOVAL: 'Retirada de kit',
  OTHER: 'Outro',
};

const DETAIL_LIMIT = 5000;

/** Unidades movimentadas no mês por tipo de movimentação. */
async function movedUnits(inMonth, type, toStatus) {
  const rows = await prisma.equipmentMovement.findMany({
    where: { type, toStatus, createdAt: inMonth },
    select: {
      quantity: true,
      fromAddressId: true,
      toAddressId: true,
      createdAt: true,
      serviceOrderId: true,
      equipment: { select: { equipmentTypeId: true } },
    },
  });
  // Uma mesma operação é registrada na origem e no destino, na mesma transação
  // (mesmo horário no banco); a chave abaixo identifica a operação.
  const seen = new Set();
  let total = 0;
  for (const m of rows) {
    const key = [
      m.createdAt.toISOString(),
      m.equipment.equipmentTypeId,
      m.fromAddressId,
      m.toAddressId,
      m.quantity,
      m.serviceOrderId,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    total += m.quantity;
  }
  return total;
}

function pct(part, whole) {
  return whole ? Math.round((part / whole) * 1000) / 10 : 0;
}

function change(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * @param {{year:number, month:number}} ref
 * @param {{details?: boolean}} opts details=true inclui as listas completas (exportações)
 */
async function buildMonthlyReport(ref, { details = false } = {}) {
  const r = monthRange(ref);
  const inMonth = { gte: r.instantStart, lt: r.instantEnd };

  const [
    fin,
    finPrev,
    recurring,
    activeClients,
    newClients,
    clientsWithOrders,
    delinquents,
    createdByType,
    completedInMonth,
    cancelledInMonth,
    backlogOpen,
    backlogInProgress,
    completedRows,
    equipmentByStatus,
    installedInMonth,
    removedInMonth,
    types,
    stockGroups,
  ] = await Promise.all([
    finance.monthSummary(ref),
    finance.monthSummary(shiftMonth(ref, -1)),
    prisma.contract.aggregate({ where: { status: 'ACTIVE' }, _sum: { monthlyValue: true }, _count: true }),
    prisma.client.count({ where: { active: true } }),
    prisma.client.count({ where: { createdAt: inMonth } }),
    prisma.serviceOrder.groupBy({ by: ['clientId'], where: { createdAt: inMonth } }),
    finance.overdueByClient(),
    prisma.serviceOrder.groupBy({ by: ['type'], where: { createdAt: inMonth }, _count: { _all: true } }),
    prisma.serviceOrder.count({ where: { status: 'COMPLETED', completedAt: inMonth } }),
    prisma.serviceOrder.count({
      where: { status: 'CANCELLED', history: { some: { toStatus: 'CANCELLED', action: { not: 'MIGRATED' }, createdAt: inMonth } } },
    }),
    prisma.serviceOrder.count({ where: { status: 'OPEN' } }),
    prisma.serviceOrder.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.serviceOrder.findMany({
      where: { status: 'COMPLETED', completedAt: inMonth },
      select: { openedAt: true, completedAt: true, technician: { select: { name: true } } },
    }),
    prisma.equipment.groupBy({ by: ['status'], _sum: { quantity: true } }),
    // Unidades movimentadas. Uma transferência de lote gera o registro na origem e no destino;
    // contamos só a do registro de destino (toStatus INSTALLED / IN_STOCK) para não duplicar.
    movedUnits(inMonth, 'INSTALL', 'INSTALLED'),
    movedUnits(inMonth, 'REMOVE', 'IN_STOCK'),
    prisma.equipmentType.findMany({ where: { active: true }, select: { id: true, name: true, minimumStock: true }, orderBy: { name: 'asc' } }),
    prisma.equipment.groupBy({ by: ['equipmentTypeId'], where: { status: 'IN_STOCK' }, _sum: { quantity: true } }),
  ]);

  // Operação
  const createdTotal = createdByType.reduce((a, g) => a + g._count._all, 0);
  const byType = Object.keys(TYPE_LABELS).map((type) => {
    const count = createdByType.find((g) => g.type === type)?._count._all || 0;
    return { type, label: TYPE_LABELS[type], count, percent: pct(count, createdTotal) };
  });
  const techMap = new Map();
  let totalHours = 0;
  for (const o of completedRows) {
    const name = o.technician?.name || 'Sem técnico';
    techMap.set(name, (techMap.get(name) || 0) + 1);
    totalHours += (new Date(o.completedAt) - new Date(o.openedAt)) / 3600000;
  }
  const byTechnician = [...techMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const avgResolutionDays = completedRows.length ? Math.round((totalHours / completedRows.length / 24) * 10) / 10 : null;

  // Equipamentos
  const eqCount = (s) => equipmentByStatus.find((g) => g.status === s)?._sum.quantity || 0;
  const stock = new Map(stockGroups.map((g) => [g.equipmentTypeId, g._sum.quantity || 0]));
  const stockByType = types.map((t) => ({
    name: t.name,
    inStock: stock.get(t.id) || 0,
    minimumStock: t.minimumStock,
    belowMinimum: t.minimumStock > 0 && (stock.get(t.id) || 0) < t.minimumStock,
  }));

  const report = {
    month: formatMonth(ref),
    generatedAt: new Date().toISOString(),
    finance: {
      expected: fin.expected,
      received: fin.received,
      open: fin.open,
      overdueInMonth: fin.overdueAmount,
      overdueTotal: fin.overdueTotal,
      overdueTotalCount: fin.overdueTotalCount,
      recurringRevenue: Number(recurring._sum.monthlyValue || 0),
      activeContracts: recurring._count,
      receivedRate: fin.expected ? pct(fin.received, fin.expected) : null,
      changes: {
        expected: change(fin.expected, finPrev.expected),
        received: change(fin.received, finPrev.received),
      },
      byStatus: [
        { status: 'PAID', label: 'Pagas', count: fin.paidCount, amount: fin.paidAmount },
        { status: 'PENDING', label: 'Pendentes', count: fin.pendingCount, amount: fin.pendingAmount },
        { status: 'OVERDUE', label: 'Atrasadas', count: fin.overdueCount, amount: fin.overdueAmount },
      ],
    },
    operations: {
      created: createdTotal,
      completed: completedInMonth,
      cancelled: cancelledInMonth,
      backlog: { open: backlogOpen, inProgress: backlogInProgress },
      byType,
      byTechnician,
      avgResolutionDays,
    },
    clients: {
      active: activeClients,
      newInMonth: newClients,
      withOrders: clientsWithOrders.length,
      delinquent: delinquents.length,
      topDelinquents: delinquents.slice(0, 10),
    },
    equipment: {
      available: eqCount('IN_STOCK'),
      installed: eqCount('INSTALLED'),
      maintenance: eqCount('MAINTENANCE'),
      damaged: eqCount('DAMAGED'),
      installedInMonth,
      removedInMonth,
      stockByType,
    },
  };

  if (details) {
    const [receivables, orders] = await Promise.all([
      finance.listReceivables({
        page: 1,
        pageSize: DETAIL_LIMIT,
        skip: 0,
        take: DETAIL_LIMIT,
        sort: 'dueDate',
        order: 'asc',
        dueFrom: r.civilStart,
        dueTo: new Date(r.civilEnd.getTime() - 86400000),
      }),
      prisma.serviceOrder.findMany({
        where: { createdAt: inMonth },
        orderBy: { orderNumber: 'asc' },
        take: DETAIL_LIMIT,
        include: {
          client: { select: { name: true } },
          company: { select: { name: true } },
          technician: { select: { name: true } },
        },
      }),
    ]);
    report.details = {
      receivables: receivables.data,
      orders,
      delinquents,
      truncated: receivables.total > DETAIL_LIMIT || orders.length === DETAIL_LIMIT,
    };
  }

  return report;
}

module.exports = { buildMonthlyReport, TYPE_LABELS };
