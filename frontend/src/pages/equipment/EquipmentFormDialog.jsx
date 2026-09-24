import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, TextField } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import LocationFields from '../../components/forms/LocationFields';
import { invalidateGroup } from '../../lib/queryKeys';
import useEquipmentTypes from './useEquipmentTypes';

const emptyLocation = { client: null, companyId: '', addressId: '' };

/**
 * Criação (entrada): tipo, QUANTIDADE e se entra em estoque ou já instalado (com local).
 * Se o equipamento já existe no mesmo local, a quantidade é somada ao registro
 * existente (não cria cadastro repetido).
 * Edição: dados cadastrais apenas; quantidade, local e situação mudam pelas ações do painel.
 */
export default function EquipmentFormDialog({ open, onClose, equipment, onSaved }) {
  const isEdit = Boolean(equipment);
  const types = useEquipmentTypes();
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm({
        equipmentTypeId: equipment?.equipmentTypeId || '',
        serialNumber: equipment?.serialNumber || '',
        notes: equipment?.notes || '',
        initialStatus: 'IN_STOCK',
        quantity: '1',
        installationDate: '',
        location: emptyLocation,
      });
      setErrors({});
      setServerError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, equipment?.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? api.put(`/equipments/${equipment.id}`, payload) : api.post('/equipments', payload)),
    meta: { silentError: true },
    onSuccess: (res) => {
      invalidateGroup(queryClient, 'equipment');
      enqueueSnackbar(isEdit ? 'Equipamento atualizado.' : 'Equipamento cadastrado.', { variant: 'success' });
      onSaved?.(res.data);
      onClose();
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  function submit() {
    const e = {};
    if (!form.equipmentTypeId) e.equipmentTypeId = 'Selecione o equipamento.';
    const qty = Number(form.quantity);
    if (!isEdit && (!Number.isInteger(qty) || qty < 1)) e.quantity = 'Informe um número inteiro maior que zero.';
    if (!isEdit && form.initialStatus === 'INSTALLED') {
      if (!form.location.client) e.client = 'Selecione o cliente.';
      if (!form.location.companyId) e.companyId = 'Selecione a empresa.';
      if (!form.location.addressId) e.addressId = 'Selecione o endereço.';
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError('');
    const payload = { equipmentTypeId: form.equipmentTypeId, notes: form.notes };
    if (isEdit) payload.serialNumber = form.serialNumber.trim();
    if (!isEdit) {
      payload.quantity = qty;
      payload.status = form.initialStatus;
      if (form.initialStatus === 'INSTALLED') {
        payload.addressId = form.location.addressId;
        payload.installationDate = form.installationDate || null;
      }
    }
    mutation.mutate(payload);
  }

  const selectedType = types.data?.find((t) => t.id === form.equipmentTypeId);
  const quantityHint =
    form.initialStatus === 'IN_STOCK' && selectedType?.counts?.inStock > 0
      ? `Já existem ${selectedType.counts.inStock} em estoque; a quantidade será somada ao mesmo registro.`
      : 'Unidades que estão entrando.';

  if (!form.location) return null;

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? 'Editar equipamento' : 'Novo equipamento / entrada no estoque'}</DialogTitle>
      <DialogContent dividers>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError('')}>
            {serverError}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              required
              label="Equipamento"
              value={types.data?.some((t) => t.id === form.equipmentTypeId) ? form.equipmentTypeId : ''}
              onChange={(e) => set({ equipmentTypeId: e.target.value })}
              error={Boolean(errors.equipmentTypeId)}
              helperText={errors.equipmentTypeId || (types.data?.length === 0 ? 'Cadastre o equipamento na aba "Estoque por tipo".' : ' ')}
            >
              {(types.data || []).map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name} {t.model ? `· ${t.model}` : ''}
                  {!isEdit && ` — ${t.counts?.inStock ?? 0} em estoque`}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            {isEdit ? (
              <TextField fullWidth label="Nº de série / identificação" value={form.serialNumber} onChange={(e) => set({ serialNumber: e.target.value })} helperText="Opcional" />
            ) : (
              <TextField
                fullWidth
                required
                type="number"
                label="Quantidade"
                value={form.quantity}
                onChange={(e) => set({ quantity: e.target.value })}
                inputProps={{ min: 1, step: 1 }}
                error={Boolean(errors.quantity)}
                helperText={errors.quantity || quantityHint}
              />
            )}
          </Grid>
          {!isEdit && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField select fullWidth label="Entrada" value={form.initialStatus} onChange={(e) => set({ initialStatus: e.target.value })}>
                  <MenuItem value="IN_STOCK">Em estoque</MenuItem>
                  <MenuItem value="INSTALLED">Já instalado em um cliente</MenuItem>
                </TextField>
              </Grid>
              {form.initialStatus === 'INSTALLED' && (
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth type="date" label="Data de instalação" value={form.installationDate} onChange={(e) => set({ installationDate: e.target.value })} InputLabelProps={{ shrink: true }} helperText="Se vazio, hoje" />
                </Grid>
              )}
              {form.initialStatus === 'INSTALLED' && (
                <Grid item xs={12}>
                  <Box sx={{ mt: 1 }}>
                    <LocationFields value={form.location} onChange={(location) => set({ location })} errors={errors} />
                  </Box>
                </Grid>
              )}
            </>
          )}
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label="Observações" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
