/** Regras puras de contratos (testadas em test/contractRules.test.js). */
const { monthDiff, monthOfCivil, dueDateFor, formatMonth, shiftMonth } = require('./dates');

const PERIODICITY_MONTHS = Object.freeze({
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
});

const PERIODICITY_LABELS = Object.freeze({
  MONTHLY: 'mensal',
  QUARTERLY: 'trimestral',
  SEMIANNUAL: 'semestral',
  ANNUAL: 'anual',
});

function periodicityMonths(periodicity) {
  return PERIODICITY_MONTHS[periodicity] || 1;
}

/** Valor de cada cobrança = valor mensal × meses do período. */
function chargeAmount(monthlyValue, periodicity) {
  return Math.round(Number(monthlyValue) * periodicityMonths(periodicity) * 100) / 100;
}

/**
 * Verifica se o contrato pode gerar cobrança na referência informada.
 * @returns {{ ok: true, dueDate: Date } | { ok: false, reason: string }}
 */
function checkBillingReference(contract, ref) {
  if (contract.status && contract.status !== 'ACTIVE') {
    return { ok: false, reason: 'Somente contratos ativos geram cobrança.' };
  }
  const start = monthOfCivil(new Date(contract.startDate));
  const diff = monthDiff(start, ref);
  if (diff < 0) {
    return { ok: false, reason: `O contrato começa em ${formatMonth(start)}.` };
  }
  if (contract.endDate) {
    const end = monthOfCivil(new Date(contract.endDate));
    if (monthDiff(end, ref) > 0) {
      return { ok: false, reason: `O contrato terminou em ${formatMonth(end)}.` };
    }
  }
  const step = periodicityMonths(contract.periodicity);
  if (diff % step !== 0) {
    const next = shiftMonth(start, Math.ceil(diff / step) * step);
    return {
      ok: false,
      reason: `Este contrato é ${PERIODICITY_LABELS[contract.periodicity]}; a próxima referência válida é ${formatMonth(next)}.`,
    };
  }
  return { ok: true, dueDate: dueDateFor(ref, contract.dueDay) };
}

/** Converte status ↔ campo legado "active". */
function activeFromStatus(status) {
  return status === 'ACTIVE';
}

module.exports = {
  PERIODICITY_MONTHS,
  periodicityMonths,
  chargeAmount,
  checkBillingReference,
  activeFromStatus,
};
