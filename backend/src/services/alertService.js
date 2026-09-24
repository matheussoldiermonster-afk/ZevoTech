/**
 * Alertas automáticos do sistema.
 * Cada alerta é calculado a partir de dados reais e aponta para a tela
 * onde o problema é resolvido. Severidades:
 *   critical (🔴) · high (🟠) · medium (🟡) · ok (🟢, quando não há pendências)
 */
const prisma = require('../prismaClient');
const { todayCivil, currentMonth, addDays, formatMonth } = require('../lib/dates');
const { checkBillingReference } = require('../lib/contractRules');
const { monthSummary } = require('./financeService');
const { backupOverview } = require('./backupService');

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, info: 3, ok: 4 };
const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const plural = (n, one, many) => (n === 1 ? one : many);

async function contractsWithoutCurrentBilling() {
  const ref = currentMonth();
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
      monthlyPayments: { where: { reference }, select: { id: true } },
    },
  });
  return contracts.filter((c) => c.monthlyPayments.length === 0 && checkBillingReference(c, ref).ok).length;
}

/** Alertas de backup (somente para administradores). */
async function backupAlerts() {
  const b = await backupOverview();
  const link = '/configuracoes?aba=backup';
  if (!b.enabled) {
    if (process.env.NODE_ENV !== 'production') return [];
    return [{ id: 'backup-disabled', severity: 'critical', title: 'Backup automático desativado', description: 'Os dados do sistema não estão sendo copiados. Ative BACKUP_ENABLED no servidor.', count: 1, link }];
  }
  const alerts = [];
  const failedAfterSuccess =
    b.lastAttempt && b.lastAttempt.ok === false && (!b.lastSuccess || b.lastAttempt.at >= b.lastSuccess.at);
  if (failedAfterSuccess && b.lastSuccess && b.lastAttempt.at === b.lastSuccess.at) {
    // backup feito, só a cópia falhou
    alerts.push({ id: 'backup-copy-failed', severity: 'high', title: 'A cópia do backup falhou', description: b.lastAttempt.error, count: 1, link });
  } else if (failedAfterSuccess) {
    alerts.push({ id: 'backup-failed', severity: 'critical', title: 'O último backup falhou', description: b.lastAttempt.error, count: 1, link });
  }
  if (!b.lastSuccess) {
    if (!failedAfterSuccess) {
      alerts.push({ id: 'backup-never', severity: 'high', title: 'Nenhum backup realizado ainda', description: `O primeiro backup automático acontece às ${b.time}. Você também pode fazer um agora.`, count: 1, link });
    }
  } else if (b.hoursSinceSuccess > 26) {
    alerts.push({ id: 'backup-stale', severity: 'critical', title: `Último backup há ${Math.floor(b.hoursSinceSuccess)} horas`, description: 'O backup diário não está sendo feito. Verifique se o servidor está ligado.', count: 1, link });
  }
  return alerts;
}

async function buildAlerts({ isAdmin = false } = {}) {
  const today = todayCivil();
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const openStatuses = { in: ['OPEN', 'IN_PROGRESS'] };

  const [finance, urgent, types, stockGroups, lateSchedules, unscheduled, damaged, dueSoon, missingBilling, incomplete] =
    await Promise.all([
      monthSummary(currentMonth()),
      prisma.serviceOrder.count({ where: { priority: 'URGENT', status: openStatuses } }),
      prisma.equipmentType.findMany({ where: { active: true, minimumStock: { gt: 0 } }, select: { id: true, name: true, minimumStock: true } }),
      prisma.equipment.groupBy({ by: ['equipmentTypeId'], where: { status: 'IN_STOCK' }, _sum: { quantity: true } }),
      prisma.serviceOrder.count({
        where: {
          status: openStatuses,
          schedules: { some: { date: { lt: today } }, none: { date: { gte: today } } },
        },
      }),
      prisma.serviceOrder.count({ where: { status: 'OPEN', schedules: { none: {} }, createdAt: { lt: weekAgo } } }),
      prisma.equipment.aggregate({ where: { status: 'DAMAGED' }, _sum: { quantity: true } }),
      prisma.monthlyPayment.count({ where: { status: 'PENDING', dueDate: { gte: today, lt: addDays(today, 4) } } }),
      contractsWithoutCurrentBilling(),
      prisma.address.count({ where: { active: true, OR: [{ street: null }, { city: null }] } }),
    ]);

  const stock = new Map(stockGroups.map((g) => [g.equipmentTypeId, g._sum.quantity || 0]));
  const damagedUnits = damaged._sum.quantity || 0;
  const lowStock = types.filter((t) => (stock.get(t.id) || 0) < t.minimumStock);

  const alerts = [];
  if (finance.overdueTotalCount > 0) {
    alerts.push({
      id: 'overdue-receivables',
      severity: 'critical',
      title: `${finance.overdueTotalCount} ${plural(finance.overdueTotalCount, 'cobrança atrasada', 'cobranças atrasadas')}`,
      description: `${brl(finance.overdueTotal)} vencidos e não pagos.`,
      count: finance.overdueTotalCount,
      link: '/financeiro?status=OVERDUE',
    });
  }
  if (urgent > 0) {
    alerts.push({
      id: 'urgent-orders',
      severity: 'critical',
      title: `${urgent} ${plural(urgent, 'OS urgente em aberto', 'OS urgentes em aberto')}`,
      description: 'Ordens com prioridade urgente ainda não concluídas.',
      count: urgent,
      link: '/ordens-servico?priority=URGENT&status=OPEN,IN_PROGRESS',
    });
  }
  if (lowStock.length > 0) {
    const names = lowStock.slice(0, 3).map((t) => t.name).join(', ');
    alerts.push({
      id: 'low-stock',
      severity: 'high',
      title: `${lowStock.length} ${plural(lowStock.length, 'item abaixo do estoque mínimo', 'itens abaixo do estoque mínimo')}`,
      description: lowStock.length > 3 ? `${names} e outros.` : `${names}.`,
      count: lowStock.length,
      link: '/equipamentos?belowMinimum=true',
    });
  }
  if (lateSchedules > 0) {
    alerts.push({
      id: 'late-schedules',
      severity: 'high',
      title: `${lateSchedules} ${plural(lateSchedules, 'atendimento com data vencida', 'atendimentos com data vencida')}`,
      description: 'OS agendadas para dias anteriores que ainda não foram concluídas.',
      count: lateSchedules,
      link: '/ordens-servico?status=OPEN,IN_PROGRESS',
    });
  }
  if (missingBilling > 0) {
    alerts.push({
      id: 'missing-billing',
      severity: 'medium',
      title: `${missingBilling} ${plural(missingBilling, 'contrato sem cobrança', 'contratos sem cobrança')} em ${formatMonth(currentMonth())}`,
      description: 'Contratos ativos cuja cobrança do mês ainda não foi gerada.',
      count: missingBilling,
      link: '/contratos',
    });
  }
  if (unscheduled > 0) {
    alerts.push({
      id: 'unscheduled-orders',
      severity: 'medium',
      title: `${unscheduled} ${plural(unscheduled, 'OS aberta', 'OS abertas')} há mais de 7 dias sem agendamento`,
      description: 'Defina data e técnico para não perder o prazo.',
      count: unscheduled,
      link: '/ordens-servico?status=OPEN',
    });
  }
  if (damagedUnits > 0) {
    alerts.push({
      id: 'damaged-equipment',
      severity: 'medium',
      title: `${damagedUnits} ${plural(damagedUnits, 'equipamento danificado', 'equipamentos danificados')}`,
      description: 'Avalie reparo, troca ou descarte.',
      count: damagedUnits,
      link: '/equipamentos?status=DAMAGED',
    });
  }
  if (dueSoon > 0) {
    alerts.push({
      id: 'due-soon',
      severity: 'info',
      title: `${dueSoon} ${plural(dueSoon, 'cobrança vence', 'cobranças vencem')} nos próximos 3 dias`,
      description: 'Bom momento para lembrar os clientes.',
      count: dueSoon,
      link: '/financeiro?status=PENDING',
    });
  }
  if (incomplete > 0) {
    alerts.push({
      id: 'incomplete-addresses',
      severity: 'info',
      title: `${incomplete} ${plural(incomplete, 'endereço incompleto', 'endereços incompletos')}`,
      description: 'Endereços sem logradouro ou cidade (em geral, vindos da migração).',
      count: incomplete,
      link: '/clientes',
    });
  }

  if (isAdmin) {
    try {
      alerts.push(...(await backupAlerts()));
    } catch (err) {
      alerts.push({ id: 'backup-unknown', severity: 'high', title: 'Não foi possível verificar os backups', description: err.message, count: 1, link: '/configuracoes?aba=backup' });
    }
  }

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  if (!alerts.some((a) => a.severity !== 'info')) {
    alerts.unshift({
      id: 'all-good',
      severity: 'ok',
      title: 'Nenhuma pendência crítica',
      description: 'Financeiro, operação e estoque em dia.',
      count: 0,
      link: null,
    });
  }
  return alerts;
}

module.exports = { buildAlerts };
