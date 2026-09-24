import { useState } from 'react';
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
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import PlayIcon from '@mui/icons-material/PlayArrowOutlined';
import DoneIcon from '@mui/icons-material/TaskAltOutlined';
import BlockIcon from '@mui/icons-material/BlockOutlined';
import ReplayIcon from '@mui/icons-material/ReplayOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import PaidIcon from '@mui/icons-material/PaidOutlined';
import api from '../../services/api';
import ErrorState from '../../components/common/ErrorState';
import StatusChip from '../../components/common/StatusChip';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useTechnicians } from '../../lib/lookups';
import { invalidateGroup, queryKeys } from '../../lib/queryKeys';
import {
  PAYMENT_STATUS,
  PERIOD,
  PRIORITY,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE,
  EQUIPMENT_STATUS,
  labelOf,
} from '../../constants/labels';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { formatAddress, isAddressIncomplete } from '../../utils/address';
import ServiceOrderFormDialog from './ServiceOrderFormDialog';

/** Efeito de cada equipamento vinculado no estoque. */
const STOCK_EFFECT = {
  CONSUME: (applied) => (applied ? 'Baixado do estoque' : 'Sai do estoque ao concluir a OS'),
  RETURN: (applied) => (applied ? 'Devolvido ao estoque' : 'Volta ao estoque ao concluir a OS'),
  REFERENCE: () => 'Equipamento do endereço (sem movimentação de estoque)',
};

const HISTORY_LABELS = {
  CREATED: 'OS criada',
  UPDATED: 'Dados alterados',
  LOCATION_CHANGED: 'Local do atendimento alterado',
  PAYMENT_UPDATED: 'Pagamento atualizado',
  CANCELLED: 'OS cancelada',
  MIGRATED: 'Registro anterior à versão 3',
};

function historyText(h) {
  if (h.action === 'STATUS_CHANGED') {
    return `Status: ${labelOf(SERVICE_ORDER_STATUS, h.fromStatus)} → ${labelOf(SERVICE_ORDER_STATUS, h.toStatus)}`;
  }
  return HISTORY_LABELS[h.action] || h.action;
}

function Section({ title, action, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Box>
  );
}

function Field({ label, children }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {children || '—'}
      </Typography>
    </Box>
  );
}

function AddScheduleForm({ order, onDone }) {
  const technicians = useTechnicians();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ date: '', time: '', period: '', technicianId: order.technicianId || '' });
  const mutation = useMutation({
    mutationFn: () =>
      api.post('/schedules', {
        serviceOrderId: order.id,
        date: form.date,
        time: form.time || null,
        period: form.period || null,
        technicianId: form.technicianId || null,
      }),
    onSuccess: () => {
      invalidateGroup(queryClient, 'schedule');
      enqueueSnackbar('Agendamento adicionado.', { variant: 'success' });
      onDone();
    },
  });
  return (
    <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, mb: 1 }}>
      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6}>
          <TextField type="date" size="small" fullWidth label="Data" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField type="time" size="small" fullWidth label="Horário" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField select size="small" fullWidth label="Período" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
            <MenuItem value="">—</MenuItem>
            {Object.entries(PERIOD).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12}>
          <TextField select size="small" fullWidth label="Técnico" value={technicians.data?.some((t) => t.id === form.technicianId) ? form.technicianId : ''} onChange={(e) => setForm({ ...form, technicianId: e.target.value })}>
            <MenuItem value="">Técnico da OS</MenuItem>
            {(technicians.data || []).map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
        <Button size="small" onClick={onDone}>
          Cancelar
        </Button>
        <Button size="small" variant="contained" disabled={!form.date || mutation.isPending} onClick={() => mutation.mutate()}>
          Agendar
        </Button>
      </Box>
    </Box>
  );
}

/** Painel lateral com o detalhe da OS. */
export default function ServiceOrderDrawer({ id, onClose }) {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [addingSchedule, setAddingSchedule] = useState(false);

  const q = useQuery({
    queryKey: queryKeys.serviceOrders.detail(id),
    queryFn: () => api.get(`/service-orders/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
  const order = q.data;

  const statusMutation = useMutation({
    mutationFn: (status) => api.put(`/service-orders/${id}`, { status }),
    onSuccess: (res, status) => {
      invalidateGroup(queryClient, 'serviceOrder');
      enqueueSnackbar(`OS marcada como "${labelOf(SERVICE_ORDER_STATUS, status).toLowerCase()}".`, { variant: 'success' });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () => api.patch(`/service-orders/${id}/payment`, { paymentStatus: 'PAID' }),
    onSuccess: () => {
      invalidateGroup(queryClient, 'serviceOrder');
      enqueueSnackbar('Pagamento registrado.', { variant: 'success' });
    },
  });

  const removeSchedule = useMutation({
    mutationFn: (scheduleId) => api.delete(`/schedules/${scheduleId}`),
    onSuccess: () => {
      invalidateGroup(queryClient, 'schedule');
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceOrders.detail(id) });
      enqueueSnackbar('Agendamento removido.', { variant: 'success' });
    },
  });

  async function changeStatus(status) {
    // Resumo do efeito no estoque (ex.: "4 × Câmera Jortan sairão do estoque")
    const units = (action) =>
      order.equipments
        .filter((l) => l.action === action)
        .map((l) => `${l.quantity ?? 1} × ${l.equipment.equipmentType?.name}`)
        .join(', ');
    const consume = units('CONSUME');
    const giveBack = units('RETURN');
    const stockOnComplete = [
      consume && `${consume} sairão do estoque e ficarão instalados neste endereço.`,
      giveBack && `${giveBack} voltarão para o estoque.`,
    ]
      .filter(Boolean)
      .join(' ');
    const hasApplied = order.equipments.some((l) => l.applied);
    const messages = {
      COMPLETED:
        stockOnComplete ||
        (Number(order.totalValue) > 0 && !order.dueDate ? 'A cobrança desta OS passará a vencer hoje.' : undefined),
      CANCELLED: 'A OS sai da agenda e deixa de gerar cobrança. Você pode reabri-la depois.',
      OPEN: hasApplied
        ? 'A OS volta para "Aberta" e a movimentação de estoque feita na conclusão é desfeita.'
        : 'A OS volta para "Aberta".',
    };
    if (['COMPLETED', 'CANCELLED', 'OPEN'].includes(status)) {
      const ok = await confirm({
        title: status === 'COMPLETED' ? 'Concluir OS?' : status === 'CANCELLED' ? 'Cancelar OS?' : 'Reabrir OS?',
        message: messages[status],
        confirmText: status === 'COMPLETED' ? 'Concluir' : status === 'CANCELLED' ? 'Cancelar OS' : 'Reabrir',
        cancelText: 'Voltar',
        danger: status === 'CANCELLED',
      });
      if (!ok) return;
    }
    statusMutation.mutate(status);
  }

  async function handleRemoveSchedule(s) {
    const ok = await confirm({
      title: 'Remover agendamento?',
      message: `O agendamento de ${formatDate(s.date)} será removido da agenda.`,
      confirmText: 'Remover',
      danger: true,
    });
    if (ok) removeSchedule.mutate(s.id);
  }

  async function handlePayment() {
    const ok = await confirm({
      title: 'Confirmar recebimento',
      message: `Registrar o pagamento de ${formatCurrency(order.totalValue)} com data de hoje?`,
      confirmText: 'Registrar pagamento',
    });
    if (ok) paymentMutation.mutate();
  }

  const busy = statusMutation.isPending;

  return (
    <Drawer anchor="right" open={Boolean(id)} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 560 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {order ? (
            <>
              <Typography variant="h6" fontWeight={700} noWrap>
                OS #{order.orderNumber} · {order.title}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <StatusChip map={SERVICE_ORDER_STATUS} value={order.status} />
                <StatusChip map={PRIORITY} value={order.priority} />
                <Chip size="small" label={labelOf(SERVICE_ORDER_TYPE, order.type)} />
              </Stack>
            </>
          ) : (
            <Skeleton width={260} height={32} />
          )}
        </Box>
        {order && isAdmin && order.status !== 'CANCELLED' && (
          <Tooltip title="Editar">
            <IconButton onClick={() => setEditing(true)} aria-label="Editar OS">
              <EditIcon />
            </IconButton>
          </Tooltip>
        )}
        <IconButton onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
        {q.isLoading && (
          <>
            <Skeleton height={80} />
            <Skeleton height={120} />
            <Skeleton height={120} />
          </>
        )}
        {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}

        {order && (
          <>
            {isAdmin && (
              <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
                {order.status === 'OPEN' && (
                  <Button variant="outlined" startIcon={<PlayIcon />} disabled={busy} onClick={() => changeStatus('IN_PROGRESS')}>
                    Iniciar
                  </Button>
                )}
                {(order.status === 'OPEN' || order.status === 'IN_PROGRESS') && (
                  <>
                    <Button variant="contained" color="success" startIcon={<DoneIcon />} disabled={busy} onClick={() => changeStatus('COMPLETED')}>
                      Concluir
                    </Button>
                    <Button color="error" startIcon={<BlockIcon />} disabled={busy} onClick={() => changeStatus('CANCELLED')}>
                      Cancelar
                    </Button>
                  </>
                )}
                {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
                  <Button startIcon={<ReplayIcon />} disabled={busy} onClick={() => changeStatus('OPEN')}>
                    Reabrir
                  </Button>
                )}
              </Stack>
            )}

            <Section title="Local">
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Field label="Cliente">{order.client?.name}</Field>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field label="Empresa">{order.company?.name}</Field>
                </Grid>
                <Grid item xs={12}>
                  <Field label={`Endereço${order.address?.label ? ` (${order.address.label})` : ''}`}>
                    {formatAddress(order.address)}
                    {isAddressIncomplete(order.address) && (
                      <Chip size="small" color="warning" variant="outlined" label="incompleto" sx={{ ml: 1 }} />
                    )}
                  </Field>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field label="Técnico">{order.technician?.name || 'Não definido'}</Field>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field label="Aberta em">{formatDateTime(order.openedAt)}</Field>
                </Grid>
                {order.completedAt && (
                  <Grid item xs={12} sm={6}>
                    <Field label="Concluída em">{formatDateTime(order.completedAt)}</Field>
                  </Grid>
                )}
                {order.description && (
                  <Grid item xs={12}>
                    <Field label="Descrição">
                      <Box component="span" sx={{ whiteSpace: 'pre-wrap' }}>
                        {order.description}
                      </Box>
                    </Field>
                  </Grid>
                )}
              </Grid>
            </Section>

            <Section
              title={`Agendamentos (${order.schedules.length})`}
              action={
                isAdmin && order.status !== 'CANCELLED' && !addingSchedule ? (
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setAddingSchedule(true)}>
                    Agendar
                  </Button>
                ) : null
              }
            >
              {addingSchedule && <AddScheduleForm order={order} onDone={() => setAddingSchedule(false)} />}
              {order.schedules.length === 0 && !addingSchedule && (
                <Typography variant="body2" color="text.secondary">
                  Sem agendamento.
                </Typography>
              )}
              <List dense disablePadding>
                {order.schedules.map((s) => (
                  <ListItem
                    key={s.id}
                    disableGutters
                    secondaryAction={
                      isAdmin ? (
                        <Tooltip title="Remover agendamento">
                          <IconButton edge="end" size="small" onClick={() => handleRemoveSchedule(s)} aria-label="Remover agendamento">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null
                    }
                  >
                    <ListItemText
                      primary={`${formatDate(s.date)} · ${s.time || labelOf(PERIOD, s.period) || 'sem horário'}`}
                      secondary={s.technician?.name || order.technician?.name || 'Sem técnico'}
                    />
                  </ListItem>
                ))}
              </List>
            </Section>

            <Section title={`Equipamentos (${order.equipments.length})`}>
              {order.equipments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum equipamento vinculado.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {order.equipments.map((link) => {
                    const e = link.equipment;
                    return (
                      <ListItem key={e.id} disableGutters secondaryAction={<StatusChip map={EQUIPMENT_STATUS} value={e.status} />}>
                        <ListItemText
                          primary={`${link.quantity ?? 1} × ${e.equipmentType?.name}`}
                          secondary={STOCK_EFFECT[link.action]?.(link.applied) || (e.serialNumber ? `nº de série ${e.serialNumber}` : null)}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Section>

            <Section title="Itens e cobrança">
              {order.items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sem itens: esta OS não gera cobrança.
                </Typography>
              ) : (
                <>
                  {order.items.map((it) => (
                    <Box key={it.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                      <Typography variant="body2">
                        {it.quantity} × {it.description}
                      </Typography>
                      <Typography variant="body2">{formatCurrency(Number(it.unitValue) * it.quantity)}</Typography>
                    </Box>
                  ))}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography fontWeight={700}>Total: {formatCurrency(order.totalValue)}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StatusChip map={PAYMENT_STATUS} value={order.paymentStatus} />
                      {(order.paymentStatus === 'PENDING' || order.paymentStatus === 'OVERDUE') && order.status !== 'CANCELLED' && (
                        <Button size="small" startIcon={<PaidIcon />} onClick={handlePayment} disabled={paymentMutation.isPending}>
                          Recebido
                        </Button>
                      )}
                    </Stack>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Vencimento: {order.dueDate ? formatDate(order.dueDate) : 'na conclusão'}
                    {order.paidAt ? ` · Pago em ${formatDateTime(order.paidAt)}` : ''}
                  </Typography>
                </>
              )}
            </Section>

            <Section title="Histórico">
              <List dense disablePadding>
                {order.history.map((h) => (
                  <ListItem key={h.id} disableGutters alignItems="flex-start">
                    <ListItemText
                      primary={historyText(h)}
                      secondary={`${formatDateTime(h.createdAt)}${h.user ? ` · ${h.user.name}` : ''}${h.note && h.action !== 'MIGRATED' ? ` · ${h.note}` : ''}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Section>
          </>
        )}
      </Box>

      {order && (
        <ServiceOrderFormDialog
          open={editing}
          order={order}
          onClose={() => setEditing(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.serviceOrders.detail(id) })}
        />
      )}
    </Drawer>
  );
}
