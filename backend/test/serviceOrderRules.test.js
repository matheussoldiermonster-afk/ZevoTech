const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTotal, periodFromTime, statusSideEffects } = require('../src/lib/serviceOrderRules');

test('total da OS sem erro de ponto flutuante', () => {
  assert.equal(calculateTotal([{ quantity: 3, unitValue: 0.1 }]), 0.3);
  assert.equal(calculateTotal([{ quantity: 2, unitValue: 150.55 }, { quantity: 1, unitValue: 49.45 }]), 350.55);
  assert.equal(calculateTotal([]), 0);
});

test('período deduzido do horário', () => {
  assert.equal(periodFromTime('08:00'), 'MORNING');
  assert.equal(periodFromTime('12:00'), 'AFTERNOON');
  assert.equal(periodFromTime('18:30'), 'EVENING');
  assert.equal(periodFromTime(null), null);
});

test('concluir define completedAt; reabrir limpa', () => {
  const now = new Date('2026-09-22T12:00:00Z');
  assert.deepEqual(statusSideEffects('OPEN', 'COMPLETED', now), { completedAt: now });
  assert.deepEqual(statusSideEffects('COMPLETED', 'IN_PROGRESS', now), { completedAt: null });
  assert.deepEqual(statusSideEffects('OPEN', 'IN_PROGRESS', now), {});
  assert.deepEqual(statusSideEffects('COMPLETED', 'COMPLETED', now), {});
});
