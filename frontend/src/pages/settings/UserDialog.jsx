import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';

export const ROLE_OPTIONS = {
  ADMIN: { label: 'Administrador', description: 'Acesso total, inclusive usuários e exclusões.' },
  FINANCIAL: { label: 'Financeiro', description: 'Consulta tudo; altera contratos, cobranças e pagamentos.' },
};

/** mode: 'create' | 'edit' | 'password' */
export default function UserDialog({ open, onClose, mode, user }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ name: user?.name || '', email: user?.email || '', role: user?.role || 'FINANCIAL', password: '' });
      setErrors({});
      setServerError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id, mode]);

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'create') return api.post('/users', { name: form.name, email: form.email, role: form.role, password: form.password });
      if (mode === 'password') return api.put(`/users/${user.id}/password`, { password: form.password });
      return api.put(`/users/${user.id}`, { name: form.name, role: form.role });
    },
    meta: { silentError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      enqueueSnackbar(
        mode === 'create' ? 'Usuário criado.' : mode === 'password' ? 'Senha redefinida.' : 'Usuário atualizado.',
        { variant: 'success' }
      );
      onClose();
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  function submit() {
    const e = {};
    if (mode !== 'password' && form.name.trim().length < 2) e.name = 'Informe o nome.';
    if (mode === 'create' && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'E-mail inválido.';
    if (mode !== 'edit' && form.password.length < 8) e.password = 'Mínimo de 8 caracteres.';
    setErrors(e);
    setServerError('');
    if (!Object.keys(e).length) mutation.mutate();
  }

  const title = mode === 'create' ? 'Novo usuário' : mode === 'password' ? `Redefinir senha de ${user?.name}` : 'Editar usuário';

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {serverError}
          </Alert>
        )}
        <Stack spacing={1} sx={{ mt: 1 }}>
          {mode !== 'password' && (
            <TextField label="Nome" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} error={Boolean(errors.name)} helperText={errors.name || ' '} />
          )}
          {mode === 'create' && (
            <TextField label="E-mail" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} error={Boolean(errors.email)} helperText={errors.email || ' '} />
          )}
          {mode !== 'password' && (
            <TextField select label="Perfil" value={form.role || 'FINANCIAL'} onChange={(e) => setForm({ ...form, role: e.target.value })} helperText={ROLE_OPTIONS[form.role]?.description || ' '}>
              {Object.entries(ROLE_OPTIONS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          {mode !== 'edit' && (
            <TextField
              type="password"
              label={mode === 'create' ? 'Senha inicial' : 'Nova senha'}
              value={form.password || ''}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={Boolean(errors.password)}
              helperText={errors.password || 'Informe a senha ao usuário; ele pode trocá-la em Configurações.'}
              autoComplete="new-password"
            />
          )}
        </Stack>
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
