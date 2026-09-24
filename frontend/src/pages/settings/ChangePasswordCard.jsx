import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { Alert, Box, Button, Stack, TextField } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import SectionCard from '../../components/common/SectionCard';

const empty = { currentPassword: '', newPassword: '', confirm: '' };

export default function ChangePasswordCard() {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword }),
    meta: { silentError: true },
    onSuccess: () => {
      enqueueSnackbar('Senha alterada.', { variant: 'success' });
      setForm(empty);
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  function submit() {
    const e = {};
    if (!form.currentPassword) e.currentPassword = 'Informe a senha atual.';
    if (form.newPassword.length < 8) e.newPassword = 'Mínimo de 8 caracteres.';
    if (form.confirm !== form.newPassword) e.confirm = 'As senhas não conferem.';
    setErrors(e);
    setServerError('');
    if (!Object.keys(e).length) mutation.mutate();
  }

  const field = (key, label) => (
    <TextField
      type="password"
      label={label}
      value={form[key]}
      onChange={(ev) => setForm({ ...form, [key]: ev.target.value })}
      error={Boolean(errors[key])}
      helperText={errors[key] || ' '}
      autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
    />
  );

  return (
    <SectionCard title="Alterar senha">
      <Box sx={{ maxWidth: 420 }}>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {serverError}
          </Alert>
        )}
        <Stack spacing={1}>
          {field('currentPassword', 'Senha atual')}
          {field('newPassword', 'Nova senha')}
          {field('confirm', 'Confirme a nova senha')}
        </Stack>
        <Button variant="contained" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Alterar senha'}
        </Button>
      </Box>
    </SectionCard>
  );
}
