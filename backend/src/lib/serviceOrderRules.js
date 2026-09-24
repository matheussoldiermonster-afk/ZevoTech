/** Regras puras de ordens de serviço (testadas em test/serviceOrderRules.test.js). */

/** Soma dos itens com precisão de centavos. */
function calculateTotal(items) {
  const cents = items.reduce(
    (sum, item) => sum + Math.round(Number(item.quantity) * Math.round(Number(item.unitValue) * 100)),
    0
  );
  return cents / 100;
}

/** Período do dia deduzido a partir do horário "HH:mm". */
function periodFromTime(time) {
  if (!time) return null;
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return 'MORNING';
  if (hour < 18) return 'AFTERNOON';
  return 'EVENING';
}

/**
 * Efeitos de uma mudança de status da OS.
 * @returns {{ completedAt?: Date|null }}
 */
function statusSideEffects(fromStatus, toStatus, now = new Date()) {
  if (fromStatus === toStatus) return {};
  if (toStatus === 'COMPLETED') return { completedAt: now };
  if (fromStatus === 'COMPLETED') return { completedAt: null };
  return {};
}

module.exports = { calculateTotal, periodFromTime, statusSideEffects };
