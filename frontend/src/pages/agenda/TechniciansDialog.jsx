import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  TextField,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import api from '../../services/api';
import ErrorState from '../../components/common/ErrorState';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { invalidateGroup } from '../../lib/queryKeys';

const empty = { id: null, name: '', phone: '', email: '' };

/** Cadastro de técnicos (sem login no sistema). */
export default function TechniciansDialog({ open, onClose }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const q = useQuery({
    queryKey: ['technicians', 'manage'],
    queryFn: () => api.get('/technicians', { params: { active: 'all' } }).then((r) => r.data),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: (data) => (data.id ? api.put(`/technicians/${data.id}`, data.body) : api.post('/technicians', data.body)),
    onSuccess: (res, data) => {
      invalidateGroup(queryClient, 'technician');
      enqueueSnackbar(data.id ? 'Técnico atualizado.' : 'Técnico cadastrado.', { variant: 'success' });
      setForm(empty);
    },
  });

  function submit() {
    if (form.name.trim().length < 2) {
      setError('Informe o nome (mínimo 2 caracteres).');
      return;
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('E-mail inválido.');
      return;
    }
    setError('');
    save.mutate({ id: form.id, body: { name: form.name.trim(), phone: form.phone, email: form.email } });
  }

  async function toggleActive(t) {
    if (t.active) {
      const ok = await confirm({
        title: `Desativar ${t.name}?`,
        message: 'O técnico deixa de aparecer para novas OS e agendamentos. O histórico é mantido.',
        confirmText: 'Desativar',
        danger: true,
      });
      if (!ok) return;
    }
    save.mutate({ id: t.id, body: { active: !t.active } });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Técnicos</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={5}>
            <TextField size="small" fullWidth label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={Boolean(error)} helperText={error || ' '} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField size="small" fullWidth label="Telefone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField size="small" fullWidth label="E-mail" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Grid>
        </Grid>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
          {form.id && <Button onClick={() => setForm(empty)}>Cancelar edição</Button>}
          <Button variant="contained" onClick={submit} disabled={save.isPending}>
            {form.id ? 'Salvar' : 'Adicionar técnico'}
          </Button>
        </Box>

        {q.isLoading && <Skeleton height={120} />}
        {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
        <List dense>
          {(q.data || []).map((t) => (
            <ListItem
              key={t.id}
              divider
              secondaryAction={
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => setForm({ id: t.id, name: t.name, phone: t.phone || '', email: t.email || '' })} aria-label={`Editar ${t.name}`}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Button size="small" color={t.active ? 'error' : 'primary'} onClick={() => toggleActive(t)}>
                    {t.active ? 'Desativar' : 'Reativar'}
                  </Button>
                </Box>
              }
            >
              <ListItemText
                primary={
                  <>
                    {t.name} {!t.active && <Chip size="small" label="inativo" sx={{ ml: 1 }} />}
                  </>
                }
                secondary={[t.phone, t.email].filter(Boolean).join(' · ') || null}
              />
            </ListItem>
          ))}
          {q.data?.length === 0 && <ListItemText secondary="Nenhum técnico cadastrado." />}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
