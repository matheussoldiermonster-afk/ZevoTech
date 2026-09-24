const test = require('node:test');
const assert = require('node:assert/strict');
const { chargeAmount, checkBillingReference } = require('../src/lib/contractRules');
const { formatDateOnly } = require('../src/lib/dates');

const base = {
  status: 'ACTIVE',
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: null,
  dueDay: 10,
};

test('valor da cobrança = valor mensal × meses do período', () => {
  assert.equal(chargeAmount(100, 'MONTHLY'), 100);
  assert.equal(chargeAmount(99.9, 'QUARTERLY'), 299.7);
  assert.equal(chargeAmount('150.00', 'ANNUAL'), 1800);
});

test('contrato mensal gera em qualquer mês a partir do início', () => {
  const r = checkBillingReference({ ...base, periodicity: 'MONTHLY' }, { year: 2026, month: 9 });
  assert.equal(r.ok, true);
  assert.equal(formatDateOnly(r.dueDate), '2026-09-10');
});

test('contrato trimestral só gera nos meses do ciclo', () => {
  const c = { ...base, periodicity: 'QUARTERLY' };
  assert.equal(checkBillingReference(c, { year: 2026, month: 4 }).ok, true);
  const bad = checkBillingReference(c, { year: 2026, month: 5 });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /2026-07/);
});

test('não gera antes do início, depois do término ou se inativo', () => {
  const c = { ...base, periodicity: 'MONTHLY', endDate: new Date('2026-06-15T00:00:00Z') };
  assert.equal(checkBillingReference(c, { year: 2025, month: 12 }).ok, false);
  assert.equal(checkBillingReference(c, { year: 2026, month: 6 }).ok, true);
  assert.equal(checkBillingReference(c, { year: 2026, month: 7 }).ok, false);
  assert.equal(checkBillingReference({ ...c, status: 'SUSPENDED' }, { year: 2026, month: 3 }).ok, false);
});

test('vencimento dia 31 em fevereiro cai no último dia', () => {
  const r = checkBillingReference({ ...base, dueDay: 31, periodicity: 'MONTHLY' }, { year: 2026, month: 2 });
  assert.equal(formatDateOnly(r.dueDate), '2026-02-28');
});
