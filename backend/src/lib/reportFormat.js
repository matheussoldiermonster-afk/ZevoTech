/** Formatação usada nas exportações (PDF/Excel). Módulo puro. */
const { zonedParts } = require('./dates');

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ 1.234,56" com espaço comum (as fontes padrão do PDF não têm o espaço fino). */
function formatBRL(value) {
  return brl.format(Number(value) || 0).replace(/[\u00A0\u202F]/g, ' ');
}

function formatPercent(value, signed = false) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const text = `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Math.abs(value))}%`;
  if (!signed || value === 0) return value < 0 ? `-${text}` : text;
  return value > 0 ? `+${text}` : `-${text}`;
}

/** "2026-09" → "Setembro de 2026" */
function formatMonthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  const text = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Data civil (00:00 UTC) → "10/09/2026". */
function formatDateBR(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** Instante → "22/09/2026 14:30" em Brasília. */
function formatDateTimeBR(value) {
  const p = zonedParts(new Date(value));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Instante → Date "de parede" para o Excel: o ExcelJS grava datas em UTC,
 * então deslocamos para que a planilha mostre o horário de Brasília.
 */
function toExcelLocal(value) {
  if (!value) return null;
  const p = zonedParts(new Date(value));
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}

module.exports = { formatBRL, formatPercent, formatMonthLabel, formatDateBR, formatDateTimeBR, toExcelLocal };
