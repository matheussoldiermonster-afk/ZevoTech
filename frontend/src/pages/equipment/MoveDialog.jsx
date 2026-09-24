import { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import LocationFields from '../../components/forms/LocationFields';

/**
 * Confirma uma movimentação de equipamento, com observação opcional.
 * needsAddress: pede o local de destino (instalação/transferência).
 * maxQuantity: quando o registro tem várias unidades, pede quantas movimentar.
 */
export default function MoveDialog({
  open,
  onClose,
  title,
  message,
  confirmText = 'Confirmar',
  danger,
  needsAddress,
  maxQuantity,
  defaultQuantity,
  quantityLabel = 'Quantidade',
  onConfirm,
}) {
  const [location, setLocation] = useState({ client: null, companyId: '', addressId: '' });
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const askQuantity = Number(maxQuantity) > 1 || defaultQuantity !== undefined;

  useEffect(() => {
    if (open) {
      setLocation({ client: null, companyId: '', addressId: '' });
      setNotes('');
      setQuantity(String(defaultQuantity ?? maxQuantity ?? 1));
      setErrors({});
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function confirm() {
    const qty = Number(quantity);
    if (askQuantity) {
      if (!Number.isInteger(qty) || qty < 1) {
        setErrors({ quantity: 'Informe um número inteiro maior que zero.' });
        return;
      }
      if (maxQuantity !== undefined && qty > maxQuantity) {
        setErrors({ quantity: `Máximo de ${maxQuantity}.` });
        return;
      }
    }
    if (needsAddress && !location.addressId) {
      setErrors({
        client: location.client ? undefined : 'Selecione o cliente.',
        companyId: location.companyId ? undefined : 'Selecione a empresa.',
        addressId: 'Selecione o endereço.',
      });
      return;
    }
    setSaving(true);
    try {
      await onConfirm({ addressId: location.addressId, movementNotes: notes, quantity: askQuantity ? qty : undefined });
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth={needsAddress ? 'md' : 'xs'} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {message && <DialogContentText sx={{ mb: 2 }}>{message}</DialogContentText>}
        {needsAddress && (
          <Box sx={{ mb: 2, mt: 1 }}>
            <LocationFields value={location} onChange={setLocation} errors={errors} />
          </Box>
        )}
        {askQuantity && (
          <TextField
            fullWidth
            type="number"
            label={quantityLabel}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputProps={{ min: 1, max: maxQuantity, step: 1 }}
            error={Boolean(errors.quantity)}
            helperText={errors.quantity || (maxQuantity !== undefined ? `Disponível neste registro: ${maxQuantity}` : ' ')}
            sx={{ mb: 2 }}
          />
        )}
        <TextField fullWidth multiline minRows={2} label="Observação (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} inputProps={{ maxLength: 500 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={confirm} disabled={saving}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
