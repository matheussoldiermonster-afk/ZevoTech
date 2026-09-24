import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import { invalidateGroup } from '../../lib/queryKeys';

export default function EquipmentTypeDialog({ open, onClose, type }) {
  const isEdit = Boolean(type);
  const [form, setForm] = useState({ name: '', category: '', model: '', minimumStock: 0 });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm({ name: type?.name || '', category: type?.category || '', model: type?.model || '', minimumStock: type?.minimumStock ?? 0 });
      setErrors({});
      setServerError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type?.id]);

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? api.put(`/equipment-types/${type.id}`, payload) : api.post('/equipment-types', payload)),
    meta: { silentError: true },
    onSuccess: () => {
      invalidateGroup(queryClient, 'equipment');
      enqueueSnackbar(isEdit ? 'Tipo atualizado.' : 'Tipo cadastrado.', { variant: 'success' });
      onClose();
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  function submit() {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Informe o nome.';
    if (form.category.trim().length < 2) e.category = 'Informe a categoria.';
    const min = Number(form.minimumStock);
    if (!Number.isInteger(min) || min < 0) e.minimumStock = 'Número inteiro, zero ou mais.';
    setErrors(e);
    if (Object.keys(e).length) return;
    mutation.mutate({ name: form.name.trim(), category: form.category.trim(), model: form.model, minimumStock: min });
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar tipo de equipamento' : 'Novo tipo de equipamento'}</DialogTitle>
      <DialogContent dividers>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {serverError}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth required label="Nome" value={form.name} onChange={set('name')} error={Boolean(errors.name)} helperText={errors.name} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth required label="Categoria" placeholder="Ex.: CFTV, Alarme, Rede" value={form.category} onChange={set('category')} error={Boolean(errors.category)} helperText={errors.category} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Modelo" value={form.model} onChange={set('model')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth type="number" label="Estoque mínimo" value={form.minimumStock} onChange={set('minimumStock')} inputProps={{ min: 0 }} error={Boolean(errors.minimumStock)} helperText={errors.minimumStock || '0 = sem alerta'} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={mutation.isPending}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
