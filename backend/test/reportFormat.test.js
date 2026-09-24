const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_TIMEZONE = 'America/Sao_Paulo';
const f = require('../src/lib/reportFormat');

test('moeda sem espaço especial (as fontes padrão do PDF não o suportam)', () => {
  const text = f.formatBRL(1234.5);
  assert.equal(text, 'R$ 1.234,50');
  assert.ok(!/[\u00A0\u202F]/.test(text));
  assert.equal(f.formatBRL(null), 'R$ 0,00');
});

test('percentual com sinal', () => {
  assert.equal(f.formatPercent(12.34, true), '+12,3%');
  assert.equal(f.formatPercent(-5, true), '-5%');
  assert.equal(f.formatPercent(0, true), '0%');
  assert.equal(f.formatPercent(null), '—');
});

test('mês por extenso e datas', () => {
  assert.equal(f.formatMonthLabel('2026-03'), 'Março de 2026');
  assert.equal(f.formatDateBR('2026-09-10T00:00:00.000Z'), '10/09/2026');
  assert.equal(f.formatDateTimeBR('2026-09-10T15:05:00.000Z'), '10/09/2026 12:05');
});

test('Excel recebe o horário de Brasília', () => {
  assert.equal(f.toExcelLocal('2026-09-10T02:30:00.000Z').toISOString(), '2026-09-09T23:30:00.000Z');
  assert.equal(f.toExcelLocal(null), null);
});
