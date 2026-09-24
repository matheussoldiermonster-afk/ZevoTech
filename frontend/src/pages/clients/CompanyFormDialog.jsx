import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField, Typography } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import { invalidateGroup } from '../../lib/queryKeys';
import { isValidCNPJ, onlyDigits } from '../../utils/document';
import AddressFields, { emptyAddress, validateAddress } from './AddressFields';

function initial(company) {
  return {
    name: company?.name || '',
    tradeName: company?.tradeName || '',
    document: company?.document || '',
    email: company?.email || '',
    phone: company?.phone || '',
    notes: company?.notes || '',
    address: { ...emptyAddress },
  };
}

/** Empresa de um cliente. Na criação, já cadastra o endereço principal. */
export default function CompanyFormDialog({ open, onClose, clientId, company }) {
  const isEdit = Boolean(company);
  const [form, setForm] = useState(() => initial(company));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm(initial(company));
      setErrors({});
      setServerError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company?.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? api.put(`/companies/${company.id}`, payload) : api.post('/companies', payload)),
    meta: { silentError: true },
    onSuccess: () => {
      invalidateGroup(queryClient, 'client');
      enqueueSnackbar(isEdit ? 'Empresa atualizada.' : 'Empresa cadastrada.', { variant: 'success' });
      onClose();
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  function submit() {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Informe o nome da empresa.';
    const docChanged = !isEdit || onlyDigits(form.document) !== onlyDigits(company.document);
    if (form.document && docChanged && !isValidCNPJ(form.document)) e.document = 'CNPJ inválido.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'E-mail inválido.';
    if (!isEdit) Object.assign(e, validateAddress(form.address, 'address.'));
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError('');
    const payload = {
      name: form.name.trim(),
      tradeName: form.tradeName,
      document: onlyDigits(form.document) || null,
      email: form.email,
      phone: form.phone,
      notes: form.notes,
    };
    if (!isEdit) {
      payload.clientId = clientId;
      payload.mainAddress = form.address;
    }
    mutation.mutate(payload);
  }

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
      <DialogContent dividers>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError('')}>
            {serverError}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <TextField fullWidth required label="Razão social / nome" value={form.name} onChange={(e) => set({ name: e.target.value })} error={Boolean(errors.name)} helperText={errors.name} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Nome fantasia" value={form.tradeName} onChange={(e) => set({ tradeName: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="CNPJ" value={form.document} onChange={(e) => set({ document: e.target.value })} error={Boolean(errors.document)} helperText={errors.document || 'Opcional'} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth label="Telefone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth label="E-mail" value={form.email} onChange={(e) => set({ email: e.target.value })} error={Boolean(errors.email)} helperText={errors.email} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label="Observações" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Grid>
        </Grid>
        {!isEdit && (
          <>
            <Typography variant="overline" color="text.secondary">
              Endereço principal
            </Typography>
            <AddressFields value={form.address} onChange={(address) => set({ address })} errors={errors} prefix="address." />
          </>
        )}
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
