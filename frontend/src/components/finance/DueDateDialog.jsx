import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';

export default function DueDateDialog({ open, onClose, currentDueDate, onConfirm }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(currentDueDate ? String(currentDueDate).slice(0, 10) : '');
      setSaving(false);
    }
  }, [open, currentDueDate]);

  async function confirm() {
    setSaving(true);
    try {
      await onConfirm(value);
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Alterar vencimento</DialogTitle>
      <DialogContent>
        <TextField
          type="date"
          fullWidth
          label="Novo vencimento"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mt: 1 }}
          helperText="Se a nova data ainda não passou, a cobrança volta a ficar pendente."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={confirm} disabled={!value || saving}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
