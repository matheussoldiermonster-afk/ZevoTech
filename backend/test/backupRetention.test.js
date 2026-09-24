const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_TIMEZONE = 'America/Sao_Paulo';
const { backupFileName, parseBackupName, planRetention, isoWeekKey } = require('../src/lib/backupRetention');

test('nome do arquivo usa o horário de Brasília e é lido de volta', () => {
  const name = backupFileName(new Date('2026-09-24T05:00:00Z')); // 02:00 em Brasília
  assert.equal(name, 'zevo_2026-09-24_02-00-00.dump');
  assert.equal(parseBackupName(name).key, '2026-09-24 02:00:00');
  assert.equal(parseBackupName('outro-arquivo.dump'), null);
  assert.equal(parseBackupName('backup-status.json'), null);
});

test('semana ISO', () => {
  assert.equal(isoWeekKey({ year: 2026, month: 1, day: 1 }), '2026-W01');
  assert.equal(isoWeekKey({ year: 2027, month: 1, day: 3 }), '2026-W53'); // domingo ainda na semana 53
  assert.equal(isoWeekKey({ year: 2026, month: 9, day: 21 }), isoWeekKey({ year: 2026, month: 9, day: 27 }));
});

function dailyNames(days, from = new Date(Date.UTC(2026, 8, 24))) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(from.getTime() - i * 86400000);
    return `zevo_${d.toISOString().slice(0, 10)}_02-00-00.dump`;
  });
}

test('com backups diários de um ano: 7 diários + semanais + mensais', () => {
  const names = dailyNames(400);
  const plan = planRetention(names, { daily: 7, weekly: 4, monthly: 12 });
  assert.ok(plan.keep.includes('zevo_2026-09-24_02-00-00.dump'));
  for (const n of dailyNames(7)) assert.ok(plan.keep.includes(n), `faltou diário ${n}`);
  assert.ok(plan.keep.length <= 7 + 4 + 12);
  assert.ok(plan.keep.length >= 12, `mantidos: ${plan.keep.length}`);
  // um por mês nos últimos 12 meses
  const months = new Set(plan.keep.map((n) => n.slice(5, 12)));
  assert.ok(months.size >= 12);
  assert.equal(plan.keep.length + plan.remove.length, 400);
});

test('vários backups no mesmo dia: mantém o mais recente do dia', () => {
  const names = ['zevo_2026-09-24_02-00-00.dump', 'zevo_2026-09-24_15-30-00.dump', 'zevo_2026-09-23_02-00-00.dump'];
  const plan = planRetention(names, { daily: 1, weekly: 0, monthly: 0 });
  assert.deepEqual(plan.keep, ['zevo_2026-09-24_15-30-00.dump']);
  assert.deepEqual(plan.remove.sort(), ['zevo_2026-09-23_02-00-00.dump', 'zevo_2026-09-24_02-00-00.dump']);
});

test('nunca apaga o mais recente nem arquivos que não são backup', () => {
  const plan = planRetention(['zevo_2026-01-01_02-00-00.dump', 'minhas-notas.txt'], { daily: 0, weekly: 0, monthly: 0 });
  assert.deepEqual(plan.keep, ['zevo_2026-01-01_02-00-00.dump']);
  assert.deepEqual(plan.remove, []);
});
