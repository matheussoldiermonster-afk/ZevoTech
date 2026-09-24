import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MoreIcon from '@mui/icons-material/MoreVert';
import PaidIcon from '@mui/icons-material/PaidOutlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
import BlockIcon from '@mui/icons-material/BlockOutlined';
import EventIcon from '@mui/icons-material/EventOutlined';
import ReplayIcon from '@mui/icons-material/ReplayOutlined';
import OpenIcon from '@mui/icons-material/OpenInNewOutlined';
import FilterOffIcon from '@mui/icons-material/FilterAltOffOutlined';
import PageHeader from '../../components/common/PageHeader';
import ServerDataGrid from '../../components/common/ServerDataGrid';
import StatusChip from '../../components/common/StatusChip';
import PaymentDialog from '../../components/finance/PaymentDialog';
import DueDateDialog from '../../components/finance/DueDateDialog';
import { useConfirm } from '../../components/common/ConfirmDialog';
import api from '../../services/api';
import { invalidateGroup, queryKeys } from '../../lib/queryKeys';
import { financeActions } from '../../lib/financeActions';
import useServerTable from '../../hooks/useServerTable';
import { PAYMENT_METHOD, PAYMENT_STATUS, labelOf } from '../../constants/labels';
import { formatCurrency, formatDate, formatDateTime, formatMonth } from '../../utils/format';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const STATUS_VALUES = ['OPEN', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];
const STATUS_OPTIONS = {
  OPEN: 'Em aberto (pendente + atrasado)',
  ...Object.fromEntries(Object.entries(PAYMENT_STATUS).map(([k, v]) => [k, v.label])),
};
// "Em aberto" é um filtro composto
const STATUS_TO_API = { OPEN: 'PENDING,OVERDUE' };
const isPayable = (row) => row.status === 'PENDING' || row.status === 'OVERDUE';
const rowKey = (r) => `${r.source}-${r.id}`;

function monthBounds(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export default function Financeiro() {
  const [urlParams, setUrlParams] = useSearchParams();
  const navigate = useNavigate();
  const status = STATUS_VALUES.includes(urlParams.get('status')) ? urlParams.get('status') : '';
  const source = ['CONTRACT', 'SERVICE_ORDER'].includes(urlParams.get('source')) ? urlParams.get('source') : '';
  const month = MONTH_RE.test(urlParams.get('mes') || '') ? urlParams.get('mes') : '';
  const paidMonth = MONTH_RE.test(urlParams.get('pagoEm') || '') ? urlParams.get('pagoEm') : '';
  const contractId = UUID_RE.test(urlParams.get('contrato') || '') ? urlParams.get('contrato') : '';
  const table = useServerTable({ sort: 'dueDate', order: 'asc' });
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [selection, setSelection] = useState([]);
  const [menu, setMenu] = useState(null); // { anchor, row }
  const [dialog, setDialog] = useState(null); // { type: 'pay' | 'batch' | 'due', row }

  const setFilter = (key, value) => {
    const next = new URLSearchParams(urlParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setUrlParams(next, { replace: true });
    table.resetPage();
    setSelection([]);
  };
  const hasFilters = status || source || month || paidMonth || contractId;

  const params = useMemo(
    () => ({
      ...table.params,
      status: STATUS_TO_API[status] || status || undefined,
      source: source || undefined,
      contractId: contractId || undefined,
      ...(month ? { dueFrom: monthBounds(month).from, dueTo: monthBounds(month).to } : {}),
      ...(paidMonth ? { paidFrom: monthBounds(paidMonth).from, paidTo: monthBounds(paidMonth).to } : {}),
    }),
    [table.params, status, source, month, paidMonth, contractId]
  );

  const query = useQuery({
    queryKey: queryKeys.finance.receivables(params),
    queryFn: () => api.get('/finance/receivables', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.data || [];
  const selectedRows = rows.filter((r) => selection.includes(rowKey(r)));
  const selectedTotal = selectedRows.reduce((sum, r) => sum + r.amount, 0);

  const mutation = useMutation({
    mutationFn: ({ run }) => run(),
    onSuccess: (res, { success }) => {
      invalidateGroup(queryClient, 'payment');
      enqueueSnackbar(typeof success === 'function' ? success(res) : success, { variant: 'success' });
      setSelection([]);
    },
  });
  const act = (run, success) => mutation.mutateAsync({ run, success });

  async function handleMenuAction(type) {
    const row = menu.row;
    setMenu(null);
    if (type === 'pay') setDialog({ type: 'pay', row });
    if (type === 'due') setDialog({ type: 'due', row });
    if (type === 'open') {
      navigate(row.source === 'CONTRACT' ? `/contratos?contrato=${row.contractId}` : `/ordens-servico?os=${row.id}`);
    }
    if (type === 'refund') {
      const ok = await confirm({
        title: 'Estornar pagamento?',
        message: `O pagamento de ${formatCurrency(row.amount)} (${row.clientName}) será desfeito e a cobrança volta a ficar em aberto.`,
        confirmText: 'Estornar',
        danger: true,
      });
      if (ok) act(() => financeActions.refund(row), 'Pagamento estornado.').catch(() => {});
    }
    if (type === 'cancel') {
      const ok = await confirm({
        title: 'Cancelar cobrança?',
        message: `A cobrança de ${formatCurrency(row.amount)} (${row.clientName}) deixa de contar no previsto e no em aberto. Pode ser reativada depois.`,
        confirmText: 'Cancelar cobrança',
        cancelText: 'Voltar',
        danger: true,
      });
      if (ok) act(() => financeActions.cancel(row), 'Cobrança cancelada.').catch(() => {});
    }
    if (type === 'reactivate') {
      act(() => financeActions.reactivate(row), 'Cobrança reativada.').catch(() => {});
    }
  }

  const columns = [
    {
      field: 'clientName',
      headerName: 'Cliente / Empresa',
      flex: 1.4,
      minWidth: 200,
      renderCell: ({ row }) => (
        <Box sx={{ py: 1, lineHeight: 1.3, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {row.clientName}
          </Typography>
          {row.companyName && row.companyName !== row.clientName && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {row.companyName}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'source',
      headerName: 'Origem',
      width: 150,
      sortable: false,
      valueGetter: (value, row) =>
        row.source === 'CONTRACT' ? `Contrato · ${formatMonth(row.reference, { short: true })}` : `OS #${row.orderNumber}`,
    },
    { field: 'dueDate', headerName: 'Vencimento', width: 115, valueFormatter: (v) => formatDate(v) },
    { field: 'amount', headerName: 'Valor', width: 125, type: 'number', valueFormatter: (v) => formatCurrency(v) },
    { field: 'status', headerName: 'Situação', width: 115, renderCell: ({ value }) => <StatusChip map={PAYMENT_STATUS} value={value} /> },
    {
      field: 'paidAt',
      headerName: 'Pagamento',
      width: 160,
      renderCell: ({ row }) =>
        row.paidAt ? (
          <Box sx={{ py: 1, lineHeight: 1.3 }}>
            <Typography variant="body2">{formatDateTime(row.paidAt).slice(0, 10)}</Typography>
            {row.method && (
              <Typography variant="caption" color="text.secondary">
                {labelOf(PAYMENT_METHOD, row.method)}
              </Typography>
            )}
          </Box>
        ) : (
          '—'
        ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 110,
      sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {isPayable(row) && (
            <Tooltip title="Registrar pagamento">
              <IconButton size="small" color="success" onClick={() => setDialog({ type: 'pay', row })} aria-label="Registrar pagamento">
                <PaidIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Mais ações">
            <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, row })} aria-label="Mais ações">
              <MoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const menuRow = menu?.row;

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Cobranças de contratos e de ordens de serviço" />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Buscar cliente, empresa ou nº da OS"
          value={table.search}
          onChange={(e) => {
            table.setSearch(e.target.value);
            setSelection([]);
          }}
          sx={{ flex: '1 1 260px', maxWidth: 400 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <TextField select size="small" label="Situação" value={status} onChange={(e) => setFilter('status', e.target.value)} sx={{ width: 200 }}>
          <MenuItem value="">Todas</MenuItem>
          {STATUS_VALUES.map((s) => (
            <MenuItem key={s} value={s}>
              {STATUS_OPTIONS[s]}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Origem" value={source} onChange={(e) => setFilter('source', e.target.value)} sx={{ width: 170 }}>
          <MenuItem value="">Todas</MenuItem>
          <MenuItem value="CONTRACT">Contratos</MenuItem>
          <MenuItem value="SERVICE_ORDER">Ordens de serviço</MenuItem>
        </TextField>
        <TextField type="month" size="small" label="Vencimento em" value={month} onChange={(e) => setFilter('mes', e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 175 }} />
        <TextField type="month" size="small" label="Pago em" value={paidMonth} onChange={(e) => setFilter('pagoEm', e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 175 }} />
        {contractId && <Chip label="Filtrado por contrato" onDelete={() => setFilter('contrato', '')} />}
        {hasFilters ? (
          <Button
            size="small"
            startIcon={<FilterOffIcon />}
            onClick={() => {
              setUrlParams(new URLSearchParams(), { replace: true });
              table.resetPage();
              setSelection([]);
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
      </Box>

      {selectedRows.length > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2, alignItems: 'center' }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => setSelection([])}>
                Limpar seleção
              </Button>
              <Button size="small" variant="contained" startIcon={<PaidIcon />} onClick={() => setDialog({ type: 'batch' })}>
                Registrar pagamento
              </Button>
            </Box>
          }
        >
          {selectedRows.length} cobrança(s) selecionada(s) · <strong>{formatCurrency(selectedTotal)}</strong>
        </Alert>
      )}

      <ServerDataGrid
        query={query}
        columns={columns}
        getRowId={rowKey}
        getRowHeight={() => 'auto'}
        checkboxSelection
        isRowSelectable={({ row }) => isPayable(row)}
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
        {...table.gridProps}
        onPaginationModelChange={(m) => {
          setSelection([]);
          table.gridProps.onPaginationModelChange(m);
        }}
      />

      {query.data && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {query.data.total} cobrança(s) · total filtrado: <strong>{formatCurrency(query.data.totalAmount)}</strong>
        </Typography>
      )}

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {menuRow && isPayable(menuRow) && [
          <MenuItem key="pay" onClick={() => handleMenuAction('pay')}>
            <ListItemIcon><PaidIcon fontSize="small" /></ListItemIcon>
            Registrar pagamento
          </MenuItem>,
          <MenuItem key="due" onClick={() => handleMenuAction('due')}>
            <ListItemIcon><EventIcon fontSize="small" /></ListItemIcon>
            Alterar vencimento
          </MenuItem>,
          <MenuItem key="cancel" onClick={() => handleMenuAction('cancel')}>
            <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon>
            Cancelar cobrança
          </MenuItem>,
        ]}
        {menuRow?.status === 'PAID' && (
          <MenuItem onClick={() => handleMenuAction('refund')}>
            <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
            Estornar pagamento
          </MenuItem>
        )}
        {menuRow?.status === 'CANCELLED' && (
          <MenuItem onClick={() => handleMenuAction('reactivate')}>
            <ListItemIcon><ReplayIcon fontSize="small" /></ListItemIcon>
            Reativar cobrança
          </MenuItem>
        )}
        <MenuItem onClick={() => handleMenuAction('open')}>
          <ListItemIcon><OpenIcon fontSize="small" /></ListItemIcon>
          {menuRow?.source === 'CONTRACT' ? 'Abrir contrato' : 'Abrir OS'}
        </MenuItem>
      </Menu>

      <PaymentDialog
        open={dialog?.type === 'pay'}
        onClose={() => setDialog(null)}
        description={dialog?.row && `${dialog.row.clientName} · vencimento ${formatDate(dialog.row.dueDate)}`}
        total={dialog?.row?.amount}
        onConfirm={(data) => act(() => financeActions.pay(dialog.row, data), 'Pagamento registrado.')}
      />
      <PaymentDialog
        open={dialog?.type === 'batch'}
        onClose={() => setDialog(null)}
        title="Registrar pagamentos em lote"
        description="A mesma data e forma de pagamento serão aplicadas a todas as cobranças selecionadas."
        total={selectedTotal}
        count={selectedRows.length}
        onConfirm={(data) =>
          act(
            () => financeActions.payBatch(selectedRows, data),
            (res) => `${res.data.paid} pagamento(s) registrado(s)${res.data.skipped ? `; ${res.data.skipped} ignorado(s) (já pagos ou cancelados)` : ''}.`
          )
        }
      />
      <DueDateDialog
        open={dialog?.type === 'due'}
        onClose={() => setDialog(null)}
        currentDueDate={dialog?.row?.dueDate}
        onConfirm={(dueDate) => act(() => financeActions.changeDueDate(dialog.row, dueDate), 'Vencimento alterado.')}
      />
    </>
  );
}
