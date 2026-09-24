/**
 * Regras de retenção dos backups (módulo puro, testado em test/backupRetention.test.js).
 *
 * Mantém: o mais recente de cada um dos últimos N dias, de cada uma das
 * últimas N semanas e de cada um dos últimos N meses. O backup mais recente
 * nunca é apagado.
 */
const { zonedParts } = require('./dates');

const NAME_RE = /^zevo_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.dump$/;
const pad = (n) => String(n).padStart(2, '0');

/** Nome do arquivo para um instante (horário da empresa): zevo_2026-09-24_02-00-00.dump */
function backupFileName(instant = new Date()) {
  const p = zonedParts(instant);
  return `zevo_${p.year}-${pad(p.month)}-${pad(p.day)}_${pad(p.hour)}-${pad(p.minute)}-${pad(p.second)}.dump`;
}

/** Lê a data (no horário da empresa) do nome do arquivo; null se não for um backup do ZEVO. */
function parseBackupName(name) {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return { year: y, month: mo, day: d, key: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`, date: new Date(Date.UTC(y, mo - 1, d, h, mi, s)) };
}

/** Semana ISO (segunda a domingo) de uma data de calendário. */
function isoWeekKey({ year, month, day }) {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

/**
 * @param {string[]} names nomes de arquivos na pasta
 * @param {{daily:number, weekly:number, monthly:number}} keep
 * @returns {{ keep: string[], remove: string[] }} (outros arquivos da pasta são ignorados)
 */
function planRetention(names, { daily = 7, weekly = 4, monthly = 12 } = {}) {
  const backups = names
    .map((name) => ({ name, info: parseBackupName(name) }))
    .filter((b) => b.info)
    .sort((a, b) => (a.info.key < b.info.key ? 1 : -1)); // mais recente primeiro

  const keep = new Set();
  if (backups.length) keep.add(backups[0].name);

  const pick = (keyFn, limit) => {
    const seen = new Set();
    for (const b of backups) {
      const k = keyFn(b.info);
      if (seen.has(k)) continue; // já pegamos o mais recente deste período
      if (seen.size >= limit) break;
      seen.add(k);
      keep.add(b.name);
    }
  };
  pick((i) => `${i.year}-${pad(i.month)}-${pad(i.day)}`, daily);
  pick((i) => isoWeekKey(i), weekly);
  pick((i) => `${i.year}-${pad(i.month)}`, monthly);

  return {
    keep: backups.filter((b) => keep.has(b.name)).map((b) => b.name),
    remove: backups.filter((b) => !keep.has(b.name)).map((b) => b.name),
  };
}

module.exports = { backupFileName, parseBackupName, planRetention, isoWeekKey };
