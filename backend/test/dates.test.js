const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_TIMEZONE = 'America/Sao_Paulo';
const d = require('../src/lib/dates');

test('data civil "YYYY-MM-DD" vira 00:00 UTC do mesmo dia', () => {
  assert.equal(d.parseDateOnly('2026-09-10').toISOString(), '2026-09-10T00:00:00.000Z');
});

test('parseDateOnly rejeita datas inexistentes', () => {
  assert.equal(d.parseDateOnly('2026-02-30'), null);
  assert.equal(d.parseDateOnly('2026-13-01'), null);
  assert.equal(d.parseDateOnly('abc'), null);
  assert.equal(d.parseDateOnly(''), null);
});

test('ISO com hora é convertido para o dia em Brasília', () => {
  // 02:00 UTC do dia 11 = 23:00 do dia 10 em Brasília
  assert.equal(d.formatDateOnly(d.parseDateOnly('2026-09-11T02:00:00Z')), '2026-09-10');
});

test('todayCivil usa o fuso de Brasília, não o do servidor', () => {
  const now = new Date('2026-09-22T01:30:00Z'); // 21/09 22:30 em Brasília
  assert.equal(d.formatDateOnly(d.todayCivil(now)), '2026-09-21');
});

test('limites do mês: datas civis em UTC e instantes em Brasília (-03:00)', () => {
  const r = d.monthRange({ year: 2026, month: 9 });
  assert.equal(r.civilStart.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(r.civilEnd.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(r.instantStart.toISOString(), '2026-09-01T03:00:00.000Z');
  assert.equal(r.instantEnd.toISOString(), '2026-10-01T03:00:00.000Z');
});

test('virada de ano no monthRange e shiftMonth', () => {
  const r = d.monthRange({ year: 2026, month: 12 });
  assert.equal(r.civilEnd.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.deepEqual(d.shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(d.shiftMonth({ year: 2026, month: 9 }, -5), { year: 2026, month: 4 });
  assert.equal(d.monthDiff({ year: 2025, month: 11 }, { year: 2026, month: 2 }), 3);
});

test('parseMonth valida o formato AAAA-MM', () => {
  assert.deepEqual(d.parseMonth('2026-09'), { year: 2026, month: 9 });
  assert.equal(d.parseMonth('2026-9'), null);
  assert.equal(d.parseMonth('2026-13'), null);
});

test('vencimento respeita meses curtos (dia 31)', () => {
  assert.equal(d.formatDateOnly(d.dueDateFor({ year: 2026, month: 2 }, 31)), '2026-02-28');
  assert.equal(d.formatDateOnly(d.dueDateFor({ year: 2028, month: 2 }, 31)), '2028-02-29');
  assert.equal(d.formatDateOnly(d.dueDateFor({ year: 2026, month: 4 }, 31)), '2026-04-30');
  assert.equal(d.formatDateOnly(d.dueDateFor({ year: 2026, month: 9 }, 10)), '2026-09-10');
});

test('início da semana é segunda-feira', () => {
  // 2026-09-20 é domingo; 2026-09-21 é segunda
  assert.equal(d.formatDateOnly(d.startOfWeekCivil(d.parseDateOnly('2026-09-20'))), '2026-09-14');
  assert.equal(d.formatDateOnly(d.startOfWeekCivil(d.parseDateOnly('2026-09-21'))), '2026-09-21');
  assert.equal(d.formatDateOnly(d.startOfWeekCivil(d.parseDateOnly('2026-09-23'))), '2026-09-21');
});

test('zonedTimeToUtc funciona em fuso com horário de verão', () => {
  // Nova York: -04:00 no verão, -05:00 no inverno
  assert.equal(d.zonedTimeToUtc(2026, 7, 1, 0, 0, 'America/New_York').toISOString(), '2026-07-01T04:00:00.000Z');
  assert.equal(d.zonedTimeToUtc(2026, 1, 1, 0, 0, 'America/New_York').toISOString(), '2026-01-01T05:00:00.000Z');
});

test('intervalo civil → instantes cobre o dia inteiro em Brasília', () => {
  const day = d.parseDateOnly('2026-09-10');
  const r = d.civilRangeToInstants(day, day);
  assert.equal(r.instantStart.toISOString(), '2026-09-10T03:00:00.000Z');
  assert.equal(r.instantEnd.toISOString(), '2026-09-11T03:00:00.000Z');
});
