/**
 * Mantém o status "Atrasado" gravado no banco.
 *
 * As consultas já calculam o status efetivo na leitura, então este job não é
 * necessário para os números estarem certos — ele existe para que o dado
 * persistido também fique correto (filtros simples, integrações, exportações).
 *
 * Idempotente. Roda na subida do servidor e depois a cada hora.
 */
const prisma = require('../prismaClient');
const { todayCivil } = require('../lib/dates');

const ONE_HOUR = 60 * 60 * 1000;

async function syncOverdueStatuses() {
  const today = todayCivil();
  const [mpOverdue, soOverdue, mpBack, soBack] = await prisma.$transaction([
    prisma.monthlyPayment.updateMany({
      where: { status: 'PENDING', dueDate: { lt: today } },
      data: { status: 'OVERDUE' },
    }),
    prisma.serviceOrder.updateMany({
      where: {
        paymentStatus: 'PENDING',
        dueDate: { lt: today },
        status: { not: 'CANCELLED' },
        totalValue: { gt: 0 },
      },
      data: { paymentStatus: 'OVERDUE' },
    }),
    // Vencimento prorrogado: volta para pendente
    prisma.monthlyPayment.updateMany({
      where: { status: 'OVERDUE', dueDate: { gte: today } },
      data: { status: 'PENDING' },
    }),
    prisma.serviceOrder.updateMany({
      where: { paymentStatus: 'OVERDUE', dueDate: { gte: today } },
      data: { paymentStatus: 'PENDING' },
    }),
  ]);
  return {
    markedOverdue: mpOverdue.count + soOverdue.count,
    restoredPending: mpBack.count + soBack.count,
  };
}

function startOverdueJob() {
  const run = async () => {
    try {
      const r = await syncOverdueStatuses();
      if (r.markedOverdue || r.restoredPending) {
        console.log(`[overdue-job] ${r.markedOverdue} marcado(s) como atrasado, ${r.restoredPending} voltou(aram) a pendente.`);
      }
    } catch (err) {
      console.error('[overdue-job] falha ao atualizar status de atraso:', err.message);
    }
  };
  run();
  const timer = setInterval(run, ONE_HOUR);
  timer.unref();
  return timer;
}

module.exports = { syncOverdueStatuses, startOverdueJob };
