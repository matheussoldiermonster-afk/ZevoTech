import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate,
  formatDateTime,
  formatMonth,
  formatCurrency,
  formatPercent,
  todayISO,
  currentMonthISO,
  shiftMonthISO,
  greeting,
} from './format.js';

test('data civil não "volta um dia" (bug corrigido)', () => {
  // Vencimento 10/09 gravado como 00:00 UTC: antes aparecia 09/09 no Brasil
  assert.equal(formatDate('2026-09-10T00:00:00.000Z'), '10/09/2026');
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate('lixo'), '—');
});

test('instante é exibido no horário de Brasília', () => {
  assert.equal(formatDateTime('2026-09-10T15:00:00.000Z'), '10/09/2026, 12:00');
});

test('"hoje" e mês atual seguem Brasília, não o fuso do computador', () => {
  const lateNight = new Date('2026-10-01T01:30:00Z'); // 30/09 22:30 em Brasília
  assert.equal(todayISO(lateNight), '2026-09-30');
  assert.equal(currentMonthISO(lateNight), '2026-09');
});

test('navegação entre meses', () => {
  assert.equal(shiftMonthISO('2026-01', -1), '2025-12');
  assert.equal(shiftMonthISO('2026-09', -5), '2026-04');
  assert.equal(shiftMonthISO('2026-12', 1), '2027-01');
});

test('rótulos de mês', () => {
  assert.equal(formatMonth('2026-09'), 'Setembro de 2026');
  assert.equal(formatMonth('2026-09', { short: true }), 'set/26');
});

test('moeda e percentual', () => {
  assert.equal(formatCurrency(1234.5).replace(/\s/g, ' '), 'R$ 1.234,50');
  assert.equal(formatPercent(12.34, { signed: true }), '+12,3%');
  assert.equal(formatPercent(-5, { signed: true }), '−5%');
  assert.equal(formatPercent(null), '—');
});

test('saudação conforme a hora em Brasília', () => {
  assert.equal(greeting(new Date('2026-09-22T11:00:00Z')), 'Bom dia'); // 08:00
  assert.equal(greeting(new Date('2026-09-22T17:00:00Z')), 'Boa tarde'); // 14:00
  assert.equal(greeting(new Date('2026-09-22T23:00:00Z')), 'Boa noite'); // 20:00
});
