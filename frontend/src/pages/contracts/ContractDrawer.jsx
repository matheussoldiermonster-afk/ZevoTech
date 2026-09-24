import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Box,
  Button,
  Divider,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import api from '../../services/api';
import ErrorState from '../../components/common/ErrorState';
import StatusChip from '../../components/common/StatusChip';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { invalidateGroup, queryKeys } from '../../lib/queryKeys';
import { CONTRACT_STATUS, PAYMENT_STATUS, PERIODICITY, labelOf } from '../../constants/labels';
import { currentMonthISO, formatCurrency, formatDate, formatMonth } from '../../utils/format';
import { formatAddress } from '../../utils/address';
import ContractFormDialog from './ContractFormDialog';

const TRANSITIONS = {
  ACTIVE: [
    { to: 'SUSPENDED', label: 'Suspender', message: 'Enquanto suspenso, o contrato não gera cobranças.' },
    { to: 'ENDED', label: 'Encerrar', message: 'O contrato é finalizado e não gera mais cobranças. As cobranças existentes são mantidas.', danger: true },
    { to: 'CANCELLED', label: 'Cancelar', message: 'O contrato é cancelado e não gera mais cobranças. As cobranças existentes são mantidas.', danger: true },
  ],
  SUSPENDED: [
    { to: 'ACTIVE', label: 'Reativar' },
    { to: 'CANCELLED', label: 'Cancelar', message: 'O contrato é cancelado e não gera mais cobranças.', danger: true },
  ],
  CANCELLED: [{ to: 'ACTIVE', label: 'Reativar' }],
  ENDED: [{ to: 'ACTIVE', label: 'Reativar' }],
};

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

export default function ContractDrawer({ id, onClose }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [reference, setReference] = useState(currentMonthISO());

  const q = useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: () => api.get(`/contracts/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
  const c = q.data;

  const mutation = useMutation({
    mutationFn: ({ run }) => run(),
    onSuccess: (res, { success }) => {
      invalidateGroup(queryClient, 'contract');
      enqueueSnackbar(success, { variant: 'success' });
    },
  });

  async function transition(t) {
    if (t.message) {
      const ok = await confirm({
        title: `${t.label} contrato?`,
        message: t.message,
        confirmText: t.label,
        cancelText: 'Voltar',
        danger: t.danger,
      });
      if (!ok) return;
    }
    mutation.mutate({
      run: () => api.put(`/contracts/${id}`, { status: t.to }),
      success: `Contrato ${labelOf(CONTRACT_STATUS, t.to).toLowerCase()}.`,
    });
  }

  function generate() {
    mutation.mutate({
      run: () => api.post(`/contracts/${id}/generate-payment`, { reference }),
      success: `Cobrança de ${formatMonth(reference).toLowerCase()} gerada.`,
    });
  }

  const months = c ? PERIODICITY[c.periodicity]?.months || 1 : 1;

  return (
    <Drawer anchor="right" open={Boolean(id)} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {c ? (
            <>
              <Typography variant="h6" fontWeight={700} noWrap>
                {c.company?.name || c.client?.name}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <StatusChip map={CONTRACT_STATUS} value={c.status} />
              </Stack>
            </>
          ) : (
            <Skeleton width={240} height={32} />
          )}
        </Box>
        {c && (
          <Tooltip title="Editar">
            <IconButton onClick={() => setEditing(true)} aria-label="Editar contrato">
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
        {c && (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
              {(TRANSITIONS[c.status] || []).map((t) => (
                <Button key={t.to} size="small" variant="outlined" color={t.danger ? 'error' : 'primary'} disabled={mutation.isPending} onClick={() => transition(t)}>
                  {t.label}
                </Button>
              ))}
            </Stack>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <Field label="Cliente">{c.client?.name}</Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="Empresa">{c.company?.name}</Field>
              </Grid>
              <Grid item xs={12}>
                <Field label="Endereço">{c.address ? formatAddress(c.address, { withLabel: true }) : 'Não vinculado a um endereço específico'}</Field>
              </Grid>
              <Grid item xs={6}>
                <Field label="Valor mensal">{formatCurrency(c.monthlyValue)}</Field>
              </Grid>
              <Grid item xs={6}>
                <Field label="Cobrança">
                  {labelOf(PERIODICITY, c.periodicity)} · {formatCurrency(Number(c.monthlyValue) * months)}
                </Field>
              </Grid>
              <Grid item xs={6}>
                <Field label="Vencimento">Dia {c.dueDay}</Field>
              </Grid>
              <Grid item xs={6}>
                <Field label="Vigência">
                  {formatDate(c.startDate)} {c.endDate ? `a ${formatDate(c.endDate)}` : '(sem término)'}
                </Field>
              </Grid>
              {c.notes && (
                <Grid item xs={12}>
                  <Field label="Observações">
                    <Box component="span" sx={{ whiteSpace: 'pre-wrap' }}>
                      {c.notes}
                    </Box>
                  </Field>
                </Grid>
              )}
            </Grid>

            <Divider sx={{ mb: 2 }} />
            <Typography variant="overline" color="text.secondary" fontWeight={700}>
              Cobranças ({c.monthlyPayments.length})
            </Typography>
            {c.status === 'ACTIVE' && (
              <Box sx={{ display: 'flex', gap: 1, my: 1.5, alignItems: 'center' }}>
                <TextField type="month" size="small" label="Referência" value={reference} onChange={(e) => setReference(e.target.value)} InputLabelProps={{ shrink: true }} />
                <Button variant="contained" size="small" onClick={generate} disabled={!reference || mutation.isPending}>
                  Gerar cobrança
                </Button>
              </Box>
            )}
            {c.monthlyPayments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhuma cobrança gerada.
              </Typography>
            ) : (
              <List dense disablePadding>
                {c.monthlyPayments.map((p) => (
                  <ListItem key={p.id} disableGutters divider secondaryAction={<StatusChip map={PAYMENT_STATUS} value={p.status} />}>
                    <ListItemText
                      primary={`${formatMonth(p.reference)} · ${formatCurrency(p.amount)}`}
                      secondary={`Vence em ${formatDate(p.dueDate)}${p.paidAt ? ' · pago' : ''}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            {c.monthlyPayments.length > 0 && (
              <Button size="small" sx={{ mt: 1 }} onClick={() => navigate(`/financeiro?contrato=${c.id}`)}>
                Gerenciar no Financeiro
              </Button>
            )}
          </>
        )}
      </Box>
      {c && <ContractFormDialog open={editing} contract={c} onClose={() => setEditing(false)} />}
    </Drawer>
  );
}
