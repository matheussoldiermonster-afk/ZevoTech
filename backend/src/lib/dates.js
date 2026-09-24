/**
 * Utilitários de data do ZEVO.
 *
 * Duas categorias de data convivem no sistema:
 *
 * 1. DATA CIVIL (vencimento, referência, dia da agenda, início de contrato):
 *    um dia do calendário, sem hora. Gravada como 00:00 UTC daquele dia.
 *    Comparações e formatação SEMPRE em UTC.
 *
 * 2. INSTANTE (createdAt, paidAt, completedAt): um momento real.
 *    Para filtrar "o que aconteceu em setembro" convertemos os limites do
 *    mês no fuso da empresa (APP_TIMEZONE, padrão America/Sao_Paulo) para UTC.
 *
 * Módulo puro (sem dependências), coberto por test/dates.test.js.
 */

const DEFAULT_TZ = 'America/Sao_Paulo';

function appTimeZone() {
  return process.env.APP_TIMEZONE || DEFAULT_TZ;
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Data civil → Date 00:00 UTC. month é 1-12. */
function civilDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Partes de calendário de um instante no fuso informado. */
function zonedParts(instant, tz = appTimeZone()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = {};
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Diferença (em ms) entre o horário local do fuso e UTC para um instante. */
function tzOffsetMs(instant, tz = appTimeZone()) {
  const p = zonedParts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

/** Horário local (no fuso da empresa) → instante UTC. Robusto a horário de verão. */
function zonedTimeToUtc(year, month, day, hour = 0, minute = 0, tz = appTimeZone()) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const firstPass = guess - tzOffsetMs(new Date(guess), tz);
  return new Date(guess - tzOffsetMs(new Date(firstPass), tz));
}

/** Dia de hoje (no fuso da empresa) como data civil. */
function todayCivil(now = new Date()) {
  const p = zonedParts(now);
  return civilDate(p.year, p.month, p.day);
}

/** Mês corrente (no fuso da empresa). */
function currentMonth(now = new Date()) {
  const p = zonedParts(now);
  return { year: p.year, month: p.month };
}

/** Instante → data civil do dia em que ele ocorreu no fuso da empresa. */
function instantToCivil(instant) {
  const p = zonedParts(instant);
  return civilDate(p.year, p.month, p.day);
}

/** "2026-09" → { year, month }. Retorna null se inválido. */
function parseMonth(value) {
  if (typeof value !== 'string') return null;
  const m = MONTH_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

function formatMonth({ year, month }) {
  return `${year}-${pad(month)}`;
}

function shiftMonth({ year, month }, delta) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** Quantidade de meses de a até b (b - a). */
function monthDiff(a, b) {
  return b.year * 12 + b.month - (a.year * 12 + a.month);
}

/** { year, month } de uma data civil. */
function monthOfCivil(civil) {
  return { year: civil.getUTCFullYear(), month: civil.getUTCMonth() + 1 };
}

/**
 * Limites de um mês.
 *  - civilStart/civilEnd: para colunas de DATA CIVIL (intervalo [start, end)).
 *  - instantStart/instantEnd: para colunas de INSTANTE (intervalo [start, end)).
 */
function monthRange({ year, month }) {
  const next = shiftMonth({ year, month }, 1);
  return {
    civilStart: civilDate(year, month, 1),
    civilEnd: civilDate(next.year, next.month, 1),
    instantStart: zonedTimeToUtc(year, month, 1),
    instantEnd: zonedTimeToUtc(next.year, next.month, 1),
  };
}

function addDays(civil, days) {
  return new Date(civil.getTime() + days * 86400000);
}

/** Intervalo de datas civis [from, to] (inclusivo) → limites de instante. */
function civilRangeToInstants(fromCivil, toCivilInclusive) {
  const endExclusive = addDays(toCivilInclusive, 1);
  return {
    instantStart: zonedTimeToUtc(fromCivil.getUTCFullYear(), fromCivil.getUTCMonth() + 1, fromCivil.getUTCDate()),
    instantEnd: zonedTimeToUtc(
      endExclusive.getUTCFullYear(),
      endExclusive.getUTCMonth() + 1,
      endExclusive.getUTCDate()
    ),
  };
}

/** Segunda-feira da semana (data civil) que contém a data civil informada. */
function startOfWeekCivil(civil) {
  const dow = civil.getUTCDay(); // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(civil, diff);
}

/**
 * Converte entrada de formulário/API em data civil.
 * Aceita "YYYY-MM-DD" (preferido) ou ISO completo (convertido para o dia
 * correspondente no fuso da empresa). Retorna null se inválida.
 */
function parseDateOnly(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : instantToCivil(value);
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const v = value.trim();
  const m = DATE_ONLY_RE.exec(v);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
    return civilDate(year, month, day);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return instantToCivil(d);
}

/** Data civil → "YYYY-MM-DD". */
function formatDateOnly(civil) {
  return `${civil.getUTCFullYear()}-${pad(civil.getUTCMonth() + 1)}-${pad(civil.getUTCDate())}`;
}

/** Vencimento dentro do mês, respeitando meses curtos (dia 31 → 30, 28 ou 29). */
function dueDateFor({ year, month }, dueDay) {
  return civilDate(year, month, Math.min(dueDay, daysInMonth(year, month)));
}

module.exports = {
  appTimeZone,
  daysInMonth,
  civilDate,
  zonedParts,
  zonedTimeToUtc,
  todayCivil,
  currentMonth,
  instantToCivil,
  parseMonth,
  formatMonth,
  shiftMonth,
  monthDiff,
  monthOfCivil,
  monthRange,
  civilRangeToInstants,
  startOfWeekCivil,
  addDays,
  parseDateOnly,
  formatDateOnly,
  dueDateFor,
};
