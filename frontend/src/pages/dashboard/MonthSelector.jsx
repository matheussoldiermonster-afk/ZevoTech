import { Box, Button, IconButton, TextField, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { currentMonthISO, formatMonth, shiftMonthISO } from '../../utils/format';

export default function MonthSelector({ value, onChange }) {
  const isCurrent = value === currentMonthISO();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      <Tooltip title="Mês anterior">
        <IconButton onClick={() => onChange(shiftMonthISO(value, -1))} aria-label="Mês anterior" size="small">
          <ChevronLeftIcon />
        </IconButton>
      </Tooltip>
      <TextField
        type="month"
        size="small"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        inputProps={{ 'aria-label': `Mês selecionado: ${formatMonth(value)}`, max: '2100-12', min: '2000-01' }}
        sx={{ width: 170 }}
      />
      <Tooltip title="Próximo mês">
        <IconButton onClick={() => onChange(shiftMonthISO(value, 1))} aria-label="Próximo mês" size="small">
          <ChevronRightIcon />
        </IconButton>
      </Tooltip>
      {!isCurrent && (
        <Button size="small" onClick={() => onChange(currentMonthISO())}>
          Mês atual
        </Button>
      )}
    </Box>
  );
}
