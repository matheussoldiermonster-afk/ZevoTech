import { Chip } from '@mui/material';

/** Chip a partir de um mapa de rótulos (ver constants/labels.js). */
export default function StatusChip({ map, value, size = 'small', ...props }) {
  const cfg = map[value] || { label: value || '—', color: 'default' };
  return <Chip size={size} label={cfg.label} color={cfg.color || 'default'} variant="outlined" {...props} />;
}
