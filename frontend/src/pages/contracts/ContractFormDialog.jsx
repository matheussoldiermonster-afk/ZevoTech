import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api, { getErrorMessage } from '../../services/api';
import LocationFields from '../../components/forms/LocationFields';
import { invalidateGroup } from '../../lib/queryKeys';
import { PERIODICITY } from '../../constants/labels';
import { formatCurrency, todayISO } from '../../utils/format';

function initial(contract) {
  return {
    location: {
      client: contract?.client ? { id: contract.client.id, name: contract.client.name } : null,
      companyId: contract?.companyId || '',
      addressId: contract?.addressId || '',
    },
    monthlyValue: contract ? String(contract.monthlyValue) : '',
    periodicity: contract?.periodicity || 'MONTHLY',
    dueDay: contract?.dueDay ?? 10,
    startDate: contract?.startDate ? contract.startDate.slice(0, 10) : todayISO(),
    endDate: contract?.endDate ? contract.endDate.slice(0, 10) : '',
    notes: contract?.notes || '',
  };
}

export default function ContractFormDialog({ open, onClose, contract, onSaved }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isEdit = Boolean(contract);
  const [form, setForm] = useState(() => initial(contract));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm(initial(contract));
      setErrors({});
      setServerError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract?.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const charge = useMemo(
    () => (Number(form.monthlyValue) || 0) * PERIODICITY[form.periodicity].months,
    [form.monthlyValue, form.periodicity]
  );

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? api.put(`/contracts/${contract.id}`, payload) : api.post('/contracts', payload)),
    meta: { silentError: true },
    onSuccess: (res) => {
      invalidateGroup(queryClient, 'contract');
      enqueueSnackbar(isEdit ? 'Contrato atualizado.' : 'Contrato criado.', { variant: 'success' });
      onSaved?.(res.data);
      onClose();
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  function submit() {
    const e = {};
    if (!form.location.client) e.client = 'Selecione o cliente.';
    if (!form.location.companyId) e.companyId = 'Selecione a empresa.';
    if (!(Number(form.monthlyValue) > 0)) e.monthlyValue = 'Informe um valor maior que zero.';
    const day = Number(form.dueDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) e.dueDay = 'Dia entre 1 e 31.';
    if (!form.startDate) e.startDate = 'Informe o início.';
    if (form.endDate && form.endDate < form.startDate) e.endDate = 'O término deve ser depois do início.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError('');
    mutation.mutate({
      clientId: form.location.client.id,
      companyId: form.location.companyId,
      addressId: form.location.addressId || null,
      monthlyValue: Number(form.monthlyValue),
      periodicity: form.periodicity,
      dueDay: day,
      startDate: form.startDate,
      endDate: form.endDate || null,
      notes: form.notes,
    });
  }

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{isEdit ? 'Editar contrato' : 'Novo contrato'}</DialogTitle>
      <DialogContent dividers>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError('')}>
            {serverError}
          </Alert>
        )}
        <Typography variant="overline" color="text.secondary">
          Contratante
        </Typography>
        <Box sx={{ mt: 1, mb: 1 }}>
          <LocationFields value={form.location} onChange={(location) => set({ location })} errors={errors} requireAddress={false} />
        </Box>
        <Typography variant="overline" color="text.secondary">
          Cobrança
        </Typography>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              type="number"
              label="Valor mensal"
              value={form.monthlyValue}
              onChange={(e) => set({ monthlyValue: e.target.value })}
              inputProps={{ min: 0, step: '0.01' }}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
              error={Boolean(errors.monthlyValue)}
              helperText={errors.monthlyValue || ' '}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField select fullWidth label="Periodicidade" value={form.periodicity} onChange={(e) => set({ periodicity: e.target.value })}>
              {Object.entries(PERIODICITY).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              fullWidth
              required
              type="number"
              label="Dia do vencimento"
              value={form.dueDay}
              onChange={(e) => set({ dueDay: e.target.value })}
              inputProps={{ min: 1, max: 31 }}
              error={Boolean(errors.dueDay)}
              helperText={errors.dueDay || 'Meses curtos usam o último dia'}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField fullWidth required type="date" label="Início" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} InputLabelProps={{ shrink: true }} error={Boolean(errors.startDate)} helperText={errors.startDate} />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField fullWidth type="date" label="Término (opcional)" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} InputLabelProps={{ shrink: true }} error={Boolean(errors.endDate)} helperText={errors.endDate} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
              Cada cobrança: <strong>{formatCurrency(charge)}</strong>
              {form.periodicity !== 'MONTHLY' && ` (${PERIODICITY[form.periodicity].months} meses)`}
            </Alert>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label="Observações" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Grid>
        </Grid>
        {isEdit && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Alterar valor ou periodicidade vale para as próximas cobranças; as já geradas mantêm o valor original.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar contrato'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
