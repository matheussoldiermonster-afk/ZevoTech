import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysISO,
  addMonthsISO,
  startOfWeekISO,
  monthGridDays,
  rangeForView,
  shiftView,
  viewTitle,
  weekdayShort,
} from './calendar.js';

test('aritmética de dias atravessa mês e ano', () => {
  assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysISO('2026-03-01', -1), '2026-02-28');
});

test('somar meses respeita meses curtos', () => {
  assert.equal(addMonthsISO('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsISO('2026-12-15', 1), '2027-01-15');
});

test('semana começa na segunda-feira', () => {
  assert.equal(startOfWeekISO('2026-09-20'), '2026-09-14'); // domingo
  assert.equal(startOfWeekISO('2026-09-23'), '2026-09-21'); // quarta
  assert.equal(weekdayShort('2026-09-23'), 'qua');
});

test('grade do mês tem semanas completas', () => {
  const days = monthGridDays('2026-09-15');
  assert.equal(days[0], '2026-08-31');
  assert.equal(days.length % 7, 0);
  assert.equal(days[days.length - 1], '2026-10-04');
});

test('intervalos e navegação por visão', () => {
  assert.deepEqual(rangeForView('day', '2026-09-23'), { from: '2026-09-23', to: '2026-09-23' });
  assert.deepEqual(rangeForView('week', '2026-09-23'), { from: '2026-09-21', to: '2026-09-27' });
  assert.equal(shiftView('week', '2026-09-23', -1), '2026-09-16');
  assert.equal(shiftView('month', '2026-09-23', 1), '2026-10-23');
});

test('títulos', () => {
  assert.equal(viewTitle('month', '2026-09-23'), 'Setembro de 2026');
  assert.equal(viewTitle('week', '2026-09-23'), '21 – 27 de set de 2026');
  assert.match(viewTitle('day', '2026-09-23'), /^Quarta-feira, 23 de setembro de 2026$/);
});
