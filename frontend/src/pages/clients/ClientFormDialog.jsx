import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api, { getErrorMessage } from '../../services/api';
import { invalidateGroup } from '../../lib/queryKeys';
import { isValidCNPJ, isValidCPF, onlyDigits } from '../../utils/document';
import AddressFields, { emptyAddress, validateAddress } from './AddressFields';

function initial(client) {
  return {
    name: client?.name || '',
    documentType: client?.documentType || 'CNPJ',
    document: client?.document || '',
    phone: client?.phone || '',
    email: client?.email || '',
    notes: client?.notes || '',
    // Primeira empresa (somente na criação)
    companyIsClient: true,
    companyName: '',
    companyDocument: '',
    address: { ...emptyAddress },
  };
}

/**
 * Criação: cliente + primeira empresa + endereço principal, em uma única transação.
 * Edição: somente os dados do cliente (empresas e endereços são mantidos na página do cliente).
 */
export default function ClientFormDialog({ open, onClose, client, onSaved }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isEdit = Boolean(client);
  const [form, setForm] = useState(() => initial(client));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm(initial(client));
      setErrors({});
      setServerError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? api.put(`/clients/${client.id}`, payload) : api.post('/clients', payload)),
    meta: { silentError: true },
    onSuccess: (res) => {
      invalidateGroup(queryClient, 'client');
      enqueueSnackbar(isEdit ? 'Cliente atualizado.' : 'Cliente cadastrado.', { variant: 'success' });
      onSaved?.(res.data);
      onClose();
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  function validate() {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Informe o nome.';
    const doc = onlyDigits(form.document);
    if (form.documentType === 'CPF' && !isValidCPF(doc)) e.document = 'CPF inválido.';
    if (form.documentType === 'CNPJ' && !isValidCNPJ(doc)) e.document = 'CNPJ inválido.';
    if (onlyDigits(form.phone).length < 10) e.phone = 'Informe o telefone com DDD.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'E-mail inválido.';
    if (!isEdit) {
      if (!form.companyIsClient && form.companyName.trim().length < 2) e.companyName = 'Informe o nome da empresa.';
      if (!form.companyIsClient && form.companyDocument && !isValidCNPJ(form.companyDocument)) {
        e.companyDocument = 'CNPJ inválido.';
      }
      Object.assign(e, validateAddress(form.address, 'address.'));
    }
    return e;
  }

  function submit() {
    // Edição legada: documentos antigos podem estar fora do padrão; só valida se o usuário alterar
    const e = validate();
    if (isEdit && onlyDigits(form.document) === onlyDigits(client.document)) delete e.document;
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError('');

    const payload = {
      name: form.name.trim(),
      documentType: form.documentType,
      document: onlyDigits(form.document),
      phone: form.phone.trim(),
      email: form.email.trim(),
      notes: form.notes,
    };
    if (!isEdit) {
      const companyDocument = form.companyIsClient
        ? form.documentType === 'CNPJ'
          ? payload.document
          : null
        : onlyDigits(form.companyDocument) || null;
      payload.companies = [
        {
          name: form.companyIsClient ? payload.name : form.companyName.trim(),
          document: companyDocument,
          email: form.companyIsClient ? payload.email : undefined,
          phone: form.companyIsClient ? payload.phone : undefined,
          addresses: [form.address],
        },
      ];
    }
    mutation.mutate(payload);
  }

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{isEdit ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
      <DialogContent dividers>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError('')}>
            {serverError}
          </Alert>
        )}
        <Typography variant="overline" color="text.secondary">
          Cliente
        </Typography>
        <Grid container spacing={2} sx={{ mt: 0, mb: 2 }}>
          <Grid item xs={12} md={6}>
            <TextField fullWidth required label="Nome / razão social" value={form.name} onChange={(e) => set({ name: e.target.value })} error={Boolean(errors.name)} helperText={errors.name} />
          </Grid>
          <Grid item xs={4} md={2}>
            <TextField select fullWidth label="Tipo" value={form.documentType} onChange={(e) => set({ documentType: e.target.value })}>
              <MenuItem value="CNPJ">CNPJ</MenuItem>
              <MenuItem value="CPF">CPF</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={8} md={4}>
            <TextField fullWidth required label={form.documentType} value={form.document} onChange={(e) => set({ document: e.target.value })} error={Boolean(errors.document)} helperText={errors.document} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth required label="Telefone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} error={Boolean(errors.phone)} helperText={errors.phone} />
          </Grid>
          <Grid item xs={12} sm={6} md={8}>
            <TextField fullWidth label="E-mail" value={form.email} onChange={(e) => set({ email: e.target.value })} error={Boolean(errors.email)} helperText={errors.email} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label="Observações" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Grid>
        </Grid>

        {!isEdit && (
          <>
            <Typography variant="overline" color="text.secondary">
              Primeira empresa
            </Typography>
            <Box sx={{ mb: 1 }}>
              <FormControlLabel
                control={<Checkbox checked={form.companyIsClient} onChange={(e) => set({ companyIsClient: e.target.checked })} />}
                label="A empresa é o próprio cliente (mesmo nome e documento)"
              />
            </Box>
            {!form.companyIsClient && (
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={7}>
                  <TextField fullWidth required label="Nome da empresa" value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} error={Boolean(errors.companyName)} helperText={errors.companyName} />
                </Grid>
                <Grid item xs={12} md={5}>
                  <TextField fullWidth label="CNPJ da empresa" value={form.companyDocument} onChange={(e) => set({ companyDocument: e.target.value })} error={Boolean(errors.companyDocument)} helperText={errors.companyDocument || 'Opcional'} />
                </Grid>
              </Grid>
            )}
            <Typography variant="overline" color="text.secondary">
              Endereço principal
            </Typography>
            <Box sx={{ mt: 1 }}>
              <AddressFields value={form.address} onChange={(address) => set({ address })} errors={errors} prefix="address." />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              Outras empresas e endereços podem ser adicionados depois, na página do cliente.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : isEdit ? 'Salvar' : 'Cadastrar cliente'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
