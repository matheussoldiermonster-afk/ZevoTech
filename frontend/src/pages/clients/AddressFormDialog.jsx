import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import { invalidateGroup } from '../../lib/queryKeys';
import AddressFields, { emptyAddress, validateAddress } from './AddressFields';

const pick = (a) =>
  a
    ? {
        label: a.label || '',
        zipCode: a.zipCode || '',
        street: a.street || '',
        number: a.number || '',
        complement: a.complement || '',
        district: a.district || '',
        city: a.city || '',
        state: a.state || '',
        reference: a.reference || '',
      }
    : { ...emptyAddress, label: '' };

export default function AddressFormDialog({ open, onClose, companyId, address }) {
  const isEdit = Boolean(address);
  const [form, setForm] = useState(() => pick(address));
  const [isMain, setIsMain] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm(pick(address));
      setIsMain(Boolean(address?.isMain));
      setErrors({});
      setServerError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address?.id]);

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? api.put(`/addresses/${address.id}`, payload) : api.post('/addresses', payload)),
    meta: { silentError: true },
    onSuccess: () => {
      invalidateGroup(queryClient, 'client');
      enqueueSnackbar(isEdit ? 'Endereço atualizado.' : 'Endereço cadastrado.', { variant: 'success' });
      onClose();
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  function submit() {
    const e = validateAddress(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError('');
    const payload = { ...form, label: form.label.trim() || 'Principal', isMain };
    if (!isEdit) payload.companyId = companyId;
    mutation.mutate(payload);
  }

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar endereço' : 'Novo endereço'}</DialogTitle>
      <DialogContent dividers>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError('')}>
            {serverError}
          </Alert>
        )}
        <AddressFields value={form} onChange={setForm} errors={errors} />
        <Box sx={{ mt: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={isMain} onChange={(e) => setIsMain(e.target.checked)} disabled={isEdit && address.isMain} />}
            label="Endereço principal da empresa"
          />
        </Box>
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
