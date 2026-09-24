/**
 * Datas de calendário como texto "AAAA-MM-DD" (datas civis, sem fuso).
 * Toda a aritmética é feita em UTC para não sofrer com o fuso do computador.
 */
const pad = (n) => String(n).padStart(2, '0');

export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDaysISO(iso, days) {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function addMonthsISO(iso, months) {
  const d = parseISODate(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return toISODate(target);
}

/** Dia da semana: 0 = segunda … 6 = domingo. */
export function weekdayMondayFirst(iso) {
  return (parseISODate(iso).getUTCDay() + 6) % 7;
}

export function startOfWeekISO(iso) {
  return addDaysISO(iso, -weekdayMondayFirst(iso));
}

export function startOfMonthISO(iso) {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonthISO(iso) {
  const d = parseISODate(startOfMonthISO(iso));
  return toISODate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Dias exibidos no mês: semanas completas (segunda a domingo). */
export function monthGridDays(iso) {
  const first = startOfWeekISO(startOfMonthISO(iso));
  const lastOfMonth = endOfMonthISO(iso);
  const last = addDaysISO(startOfWeekISO(lastOfMonth), 6);
  const days = [];
  for (let d = first; d <= last; d = addDaysISO(d, 1)) days.push(d);
  return days;
}

/** Intervalo [from, to] consultado na API para cada visão. */
export function rangeForView(view, iso) {
  if (view === 'day') return { from: iso, to: iso };
  if (view === 'week') {
    const from = startOfWeekISO(iso);
    return { from, to: addDaysISO(from, 6) };
  }
  const days = monthGridDays(iso);
  return { from: days[0], to: days[days.length - 1] };
}

export function shiftView(view, iso, direction) {
  if (view === 'day') return addDaysISO(iso, direction);
  if (view === 'week') return addDaysISO(iso, 7 * direction);
  return addMonthsISO(iso, direction);
}

const WEEKDAYS_SHORT = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
export const weekdayShort = (iso) => WEEKDAYS_SHORT[weekdayMondayFirst(iso)];
export const WEEKDAY_HEADERS = WEEKDAYS_SHORT;

/** Título da visão atual ("22 de setembro de 2026", "21 – 27 set 2026", "Setembro de 2026"). */
export function viewTitle(view, iso) {
  const fmt = (d, opts) => parseISODate(d).toLocaleDateString('pt-BR', { timeZone: 'UTC', ...opts });
  if (view === 'day') {
    const t = fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  if (view === 'week') {
    const { from, to } = rangeForView('week', iso);
    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    const left = sameMonth ? fmt(from, { day: 'numeric' }) : fmt(from, { day: 'numeric', month: 'short' });
    return `${left} – ${fmt(to, { day: 'numeric', month: 'short', year: 'numeric' })}`.replace(/\./g, '');
  }
  const t = fmt(iso, { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Ordem dentro do dia: horário, depois período, depois sem horário. */
const PERIOD_ORDER = { MORNING: '08:00', AFTERNOON: '13:00', EVENING: '18:00' };
export function scheduleSortKey(s) {
  return s.time || PERIOD_ORDER[s.period] || '99:99';
}
