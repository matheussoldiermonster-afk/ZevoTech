/** "Rua X, 120 · Centro · Brasília/DF" */
export function formatAddress(a, { withLabel = false } = {}) {
  if (!a) return '—';
  const street = [a.street, a.number].filter(Boolean).join(', ');
  const cityState = [a.city, a.state].filter(Boolean).join('/');
  const text = [street, a.complement, a.district, cityState].filter(Boolean).join(' · ');
  const base = text || 'Endereço incompleto';
  return withLabel && a.label ? `${a.label} — ${base}` : base;
}

export function isAddressIncomplete(a) {
  return !a?.street || !a?.city;
}
