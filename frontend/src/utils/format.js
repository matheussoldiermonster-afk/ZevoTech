/**
 * Formatação padronizada.
 *
 * IMPORTANTE — dois tipos de data (mesma convenção do backend):
 *  - formatDate(): DATA CIVIL (vencimento, referência, agenda). Gravada como
 *    00:00 UTC; formatar em UTC evita o bug de "um dia a menos".
 *  - formatDateTime(): INSTANTE (pagamento, criação). Exibido no fuso da empresa.
 */
export const APP_TIMEZONE = 'America/Sao_Paulo';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatCurrency(value) {
  return brl.format(Number(value) || 0);
}

export function formatCompactCurrency(value) {
  const n = Number(value) || 0;
  return Math.abs(n) < 1000 ? brl.format(n) : brlCompact.format(n);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
}

export function formatPercent(value, { signed = false } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const text = `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Math.abs(value))}%`;
  if (!signed) return text;
  if (value > 0) return `+${text}`;
  if (value < 0) return `−${text}`;
  return text;
}

/** Data civil → "22/09/2026". */
export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** Instante → "22/09/2026 14:30" no fuso da empresa. */
export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Partes de data/hora "agora" no fuso da empresa. */
export function nowParts(now = new Date()) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(now)
    .forEach((p) => {
      if (p.type !== 'literal') parts[p.type] = Number(p.value);
    });
  return parts;
}

const pad = (n) => String(n).padStart(2, '0');

/** Hoje (fuso da empresa) → "2026-09-22". */
export function todayISO(now = new Date()) {
  const p = nowParts(now);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Mês atual (fuso da empresa) → "2026-09". */
export function currentMonthISO(now = new Date()) {
  const p = nowParts(now);
  return `${p.year}-${pad(p.month)}`;
}

export function shiftMonthISO(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function compareMonthISO(a, b) {
  return a.localeCompare(b);
}

/** "2026-09" → "setembro de 2026" (long) ou "set/26" (short). */
export function formatMonth(month, { short = false } = {}) {
  if (!month) return '—';
  const [y, m] = String(month).slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  if (short) {
    const name = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
    return `${name}/${String(y).slice(2)}`;
  }
  const text = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Saudação conforme a hora em Brasília. */
export function greeting(now = new Date()) {
  const { hour } = nowParts(now);
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || '';
}
