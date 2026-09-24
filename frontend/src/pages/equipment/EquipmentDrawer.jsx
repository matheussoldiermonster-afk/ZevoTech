import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Grid,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import api from '../../services/api';
import ErrorState from '../../components/common/ErrorState';
import StatusChip from '../../components/common/StatusChip';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateGroup, queryKeys } from '../../lib/queryKeys';
import { EQUIPMENT_STATUS, MOVEMENT_TYPE, labelOf } from '../../constants/labels';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatAddress } from '../../utils/address';
import EquipmentFormDialog from './EquipmentFormDialog';
import MoveDialog from './MoveDialog';

/** Ações disponíveis por situação atual. */
function actionsFor(e) {
  const list = [];
  if (e.status === 'IN_STOCK') {
    // Controle de estoque por quantidade
    list.push({ key: 'entry', label: 'Entrada', adjust: 1, message: 'Unidades que chegaram ao estoque (compra, devolução etc.).' });
    if (e.quantity > 0) {
      list.push({ key: 'exit', label: 'Saída', adjust: -1, danger: true, message: 'Unidades que saíram do estoque sem ir para um cliente (venda, perda etc.).' });
    }
  }
  // Sem unidades, só a entrada faz sentido
  if (e.quantity === 0) return list;
  if (e.status === 'IN_STOCK') {
    list.push({ key: 'install', label: 'Instalar', needsAddress: true, patch: { status: 'INSTALLED' } });
  }
  if (e.status === 'INSTALLED') {
    list.push({ key: 'transfer', label: 'Transferir', needsAddress: true, patch: { status: 'INSTALLED' } });
  }
  if (e.status === 'MAINTENANCE' && e.addressId) {
    list.push({ key: 'back', label: 'Voltou da manutenção (reinstalado)', patch: { status: 'INSTALLED' } });
  }
  if (e.status !== 'MAINTENANCE' && e.status !== 'DISCARDED') {
    list.push({ key: 'maint', label: 'Enviar para manutenção', patch: { status: 'MAINTENANCE' } });
  }
  if (e.status !== 'IN_STOCK' && e.status !== 'DISCARDED') {
    list.push({
      key: 'stock',
      label: 'Devolver ao estoque',
      patch: { status: 'IN_STOCK', addressId: null },
      message: e.addressId ? 'O equipamento deixa de estar vinculado ao endereço atual.' : undefined,
    });
  }
  if (e.status !== 'DAMAGED' && e.status !== 'DISCARDED') {
    list.push({ key: 'damaged', label: 'Marcar como danificado', patch: { status: 'DAMAGED' }, danger: true });
  }
  if (e.status !== 'DISCARDED') {
    list.push({
      key: 'discard',
      label: 'Descartar',
      danger: true,
      discard: true,
      message: 'As unidades descartadas saem do estoque e das listas. O histórico de movimentações é mantido.',
    });
  }
  return list;
}

export default function EquipmentDrawer({ id, onClose }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState(null);

  const q = useQuery({
    queryKey: queryKeys.equipments.detail(id),
    queryFn: () => api.get(`/equipments/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
  const movements = useQuery({
    queryKey: queryKeys.equipments.movements(id),
    queryFn: () => api.get(`/equipments/${id}/movements`).then((r) => r.data),
    enabled: Boolean(id),
  });
  const e = q.data;

  const mutation = useMutation({
    mutationFn: ({ act, addressId, movementNotes, quantity }) => {
      if (act.adjust) {
        return api.post(`/equipments/${id}/adjust`, { delta: act.adjust * quantity, notes: movementNotes || null });
      }
      if (act.discard) return api.delete(`/equipments/${id}`, { params: { quantity } });
      return api.put(`/equipments/${id}`, {
        ...act.patch,
        ...(act.needsAddress ? { addressId } : {}),
        quantity,
        movementNotes: movementNotes || null,
      });
    },
    onSuccess: (res, { act, quantity }) => {
      invalidateGroup(queryClient, 'equipment');
      enqueueSnackbar(`${act.label}${quantity ? ` de ${quantity} unidade(s)` : ''}: registrado.`, { variant: 'success' });
      // Se todas as unidades deste registro saíram (e não é o estoque), fecha o painel
      if (act.discard && e?.status !== 'IN_STOCK' && quantity >= e?.quantity) onClose();
    },
  });

  return (
    <Drawer anchor="right" open={Boolean(id)} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 500 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {e ? (
            <>
              <Typography variant="h6" fontWeight={700} noWrap>
                {e.equipmentType?.name}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                <StatusChip map={EQUIPMENT_STATUS} value={e.status} />
                <Chip
                  size="small"
                  color={e.status === 'IN_STOCK' && e.quantity === 0 ? 'error' : 'primary'}
                  label={e.status === 'IN_STOCK' ? (e.quantity === 0 ? 'Esgotado' : `${e.quantity} disponíveis`) : `${e.quantity} un.`}
                />
                {e.serialNumber && (
                  <Typography variant="caption" color="text.secondary">
                    nº {e.serialNumber}
                  </Typography>
                )}
              </Stack>
            </>
          ) : (
            <Skeleton width={220} height={32} />
          )}
        </Box>
        {e && isAdmin && e.status !== 'DISCARDED' && (
          <Tooltip title="Editar cadastro">
            <IconButton onClick={() => setEditing(true)} aria-label="Editar equipamento">
              <EditIcon />
            </IconButton>
          </Tooltip>
        )}
        <IconButton onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
        {q.isLoading && <Skeleton height={200} />}
        {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
        {e && (
          <>
            {isAdmin && (
              <Stack direction="row" sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
                {actionsFor(e).map((a) => (
                  <Button key={a.key} size="small" variant="outlined" color={a.danger ? 'error' : 'primary'} onClick={() => setAction(a)} disabled={mutation.isPending}>
                    {a.label}
                  </Button>
                ))}
              </Stack>
            )}

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Local atual
                </Typography>
                {e.address ? (
                  <Typography variant="body2">
                    {e.client && (
                      <Link component="button" variant="body2" onClick={() => navigate(`/clientes/${e.client.id}`)}>
                        {e.client.name}
                      </Link>
                    )}
                    {e.address.company?.name && e.address.company.name !== e.client?.name ? ` — ${e.address.company.name}` : ''}
                    <br />
                    {formatAddress(e.address, { withLabel: true })}
                  </Typography>
                ) : (
                  <Typography variant="body2">{e.status === 'IN_STOCK' ? 'Estoque' : 'Sem local vinculado'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" component="div">
                  Categoria / modelo
                </Typography>
                <Typography variant="body2">
                  {e.equipmentType?.category}
                  {e.equipmentType?.model ? ` · ${e.equipmentType.model}` : ''}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" component="div">
                  Instalado em
                </Typography>
                <Typography variant="body2">{e.installationDate ? formatDate(e.installationDate) : '—'}</Typography>
              </Grid>
              {e.notes && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Observações
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {e.notes}
                  </Typography>
                </Grid>
              )}
            </Grid>

            <Divider sx={{ mb: 1 }} />
            <Typography variant="overline" color="text.secondary" fontWeight={700}>
              Movimentações
            </Typography>
            {movements.isLoading && <Skeleton height={120} />}
            {movements.isError && <ErrorState error={movements.error} onRetry={movements.refetch} compact />}
            <List dense disablePadding>
              {(movements.data || []).map((m) => {
                const to = m.toAddress ? `${m.toAddress.company?.name || ''} · ${m.toAddress.label}` : null;
                const from = m.fromAddress ? `${m.fromAddress.company?.name || ''} · ${m.fromAddress.label}` : null;
                const route = from && to && from !== to ? `${from} → ${to}` : to || from;
                return (
                  <ListItem key={m.id} disableGutters divider alignItems="flex-start">
                    <ListItemText
                      primary={`${labelOf(MOVEMENT_TYPE, m.type)} · ${m.quantity ?? 1} un.`}
                      secondary={
                        <>
                          {route && <span style={{ display: 'block' }}>{route}</span>}
                          {m.notes && <span style={{ display: 'block' }}>{m.notes}</span>}
                          {formatDateTime(m.createdAt)}
                          {m.user ? ` · ${m.user.name}` : ''}
                          {m.serviceOrder ? ' · ' : ''}
                          {m.serviceOrder && (
                            <Link component="button" variant="caption" onClick={() => navigate(`/ordens-servico?os=${m.serviceOrder.id}`)}>
                              OS #{m.serviceOrder.orderNumber}
                            </Link>
                          )}
                        </>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                  </ListItem>
                );
              })}
              {movements.data?.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Sem movimentações registradas.
                </Typography>
              )}
            </List>
          </>
        )}
      </Box>

      {e && <EquipmentFormDialog open={editing} equipment={e} onClose={() => setEditing(false)} />}
      <MoveDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action?.label}
        message={action?.message}
        needsAddress={action?.needsAddress}
        danger={action?.danger}
        confirmText={action?.label}
        quantityLabel={action?.adjust ? 'Quantidade' : 'Quantidade a movimentar'}
        maxQuantity={action?.adjust === 1 ? undefined : e?.quantity}
        defaultQuantity={action?.adjust || e?.status === 'IN_STOCK' ? 1 : e?.quantity}
        onConfirm={(data) => mutation.mutateAsync({ act: action, ...data })}
      />
    </Drawer>
  );
}
