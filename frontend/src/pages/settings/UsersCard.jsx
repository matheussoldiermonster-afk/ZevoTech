import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import KeyIcon from '@mui/icons-material/KeyOutlined';
import api from '../../services/api';
import SectionCard from '../../components/common/SectionCard';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime } from '../../utils/format';
import UserDialog, { ROLE_OPTIONS } from './UserDialog';

export default function UsersCard() {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null); // { mode, user }

  const q = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then((r) => r.data) });

  const toggle = useMutation({
    mutationFn: (u) => api.put(`/users/${u.id}`, { active: !u.active }),
    onSuccess: (res, u) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      enqueueSnackbar(u.active ? 'Usuário desativado.' : 'Usuário reativado.', { variant: 'success' });
    },
  });

  async function handleToggle(u) {
    if (u.active) {
      const ok = await confirm({
        title: `Desativar ${u.name}?`,
        message: 'O acesso é bloqueado em até 30 segundos, mesmo que a pessoa esteja com o sistema aberto.',
        confirmText: 'Desativar',
        danger: true,
      });
      if (!ok) return;
    }
    toggle.mutate(u);
  }

  return (
    <SectionCard
      title="Usuários"
      subtitle="Quem pode acessar o sistema"
      action={
        <Button startIcon={<AddIcon />} onClick={() => setDialog({ mode: 'create' })}>
          Novo usuário
        </Button>
      }
      loading={q.isLoading}
      error={q.isError && !q.data ? q.error : null}
      onRetry={q.refetch}
      skeleton={<Skeleton variant="rounded" height={180} />}
    >
      {q.data && (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Perfil</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell>Atualizado</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {q.data.map((u) => {
                const isMe = u.id === me?.id;
                return (
                  <TableRow key={u.id} sx={{ opacity: u.active ? 1 : 0.6 }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {u.name} {isMe && <Chip size="small" label="você" sx={{ ml: 0.5, height: 18 }} />}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {u.email}
                      </Typography>
                    </TableCell>
                    <TableCell>{ROLE_OPTIONS[u.role]?.label || u.role}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" color={u.active ? 'success' : 'default'} label={u.active ? 'Ativo' : 'Inativo'} />
                    </TableCell>
                    <TableCell>{formatDateTime(u.updatedAt)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => setDialog({ mode: 'edit', user: u })} aria-label={`Editar ${u.name}`}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Redefinir senha">
                        <IconButton size="small" onClick={() => setDialog({ mode: 'password', user: u })} aria-label={`Redefinir senha de ${u.name}`}>
                          <KeyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {!isMe && (
                        <Button size="small" color={u.active ? 'error' : 'primary'} onClick={() => handleToggle(u)} disabled={toggle.isPending}>
                          {u.active ? 'Desativar' : 'Reativar'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
      <UserDialog open={Boolean(dialog)} mode={dialog?.mode} user={dialog?.user} onClose={() => setDialog(null)} />
    </SectionCard>
  );
}
