import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { PAYMENT_METHOD } from '../../constants/labels';
import { formatCurrency, todayISO } from '../../utils/format';

/**
 * Registro de pagamento (uma ou várias cobranças).
 * onConfirm({ paidAt, method }) deve retornar uma Promise.
 */
export default function PaymentDialog({ open, onClose, title = 'Registrar pagamento', description, total, count = 1, onConfirm }) {
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPaidAt(todayISO());
      setMethod('');
      setError('');
      setSaving(false);
    }
  }, [open]);

  async function confirm() {
    if (!paidAt) {
      setError('Informe a data do pagamento.');
      return;
    }
    if (paidAt > todayISO()) {
      setError('A data do pagamento não pode estar no futuro.');
      return;
    }
    setSaving(true);
    try {
      await onConfirm({ paidAt, method });
      onClose();
    } catch {
      setSaving(false); // o erro já foi mostrado pelo toast da mutação
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}
        {total !== undefined && (
          <Alert severity="info" icon={false} sx={{ mb: 2 }}>
            {count > 1 ? `${count} cobranças · ` : ''}
            <strong>{formatCurrency(total)}</strong>
          </Alert>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            type="date"
            label="Data do pagamento"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: todayISO() }}
            error={Boolean(error)}
            helperText={error || ' '}
          />
          <TextField select label="Forma de pagamento" value={method} onChange={(e) => setMethod(e.target.value)}>
            <MenuItem value="">Não informada</MenuItem>
            {Object.entries(PAYMENT_METHOD).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={confirm} disabled={saving}>
          {saving ? 'Registrando…' : 'Confirmar pagamento'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
