import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Checkbox,
  InputAdornment,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterOffIcon from '@mui/icons-material/FilterAltOffOutlined';
import api from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import ServerDataGrid from '../../components/common/ServerDataGrid';
import StatusChip from '../../components/common/StatusChip';
import useServerTable from '../../hooks/useServerTable';
import { useAuth } from '../../contexts/AuthContext';
import { useTechnicians } from '../../lib/lookups';
import { queryKeys } from '../../lib/queryKeys';
import {
  PAYMENT_STATUS,
  PERIOD,
  PRIORITY,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE,
  labelOf,
} from '../../constants/labels';
import { formatCurrency, formatDate } from '../../utils/format';
import { formatAddress } from '../../utils/address';
import ServiceOrderDrawer from './ServiceOrderDrawer';
import ServiceOrderFormDialog from './ServiceOrderFormDialog';

const UUID_RE = /^[0-9a-f-]{36}$/i;

function listFromParam(value, allowed) {
  return (value || '').split(',').filter((v) => allowed.includes(v));
}

function MultiSelect({ label, value, options, onChange, width = 190 }) {
  return (
    <TextField
      select
      size="small"
      label={label}
      sx={{ width }}
      SelectProps={{
        multiple: true,
        value,
        onChange: (e) => onChange(e.target.value),
        renderValue: (sel) => (sel.length === 1 ? options[sel[0]].label : `${sel.length} selecionados`),
      }}
    >
      {Object.entries(options).map(([k, v]) => (
        <MenuItem key={k} value={k}>
          <Checkbox size="small" checked={value.includes(k)} />
          <ListItemText primary={v.label} />
        </MenuItem>
      ))}
    </TextField>
  );
}

export default function ServiceOrders() {
  const { isAdmin } = useAuth();
  const [urlParams, setUrlParams] = useSearchParams();
  const table = useServerTable({ sort: 'createdAt', order: 'desc' });
  const technicians = useTechnicians();
  const [creating, setCreating] = useState(false);

  const status = listFromParam(urlParams.get('status'), Object.keys(SERVICE_ORDER_STATUS));
  const priority = listFromParam(urlParams.get('priority'), Object.keys(PRIORITY));
  const type = listFromParam(urlParams.get('type'), Object.keys(SERVICE_ORDER_TYPE));
  const technicianId = UUID_RE.test(urlParams.get('technicianId') || '') ? urlParams.get('technicianId') : '';
  const clientId = UUID_RE.test(urlParams.get('clientId') || '') ? urlParams.get('clientId') : '';
  const openId = UUID_RE.test(urlParams.get('os') || '') ? urlParams.get('os') : null;

  const setParam = (key, value) => {
    const next = new URLSearchParams(urlParams);
    const v = Array.isArray(value) ? value.join(',') : value;
    if (v) next.set(key, v);
    else next.delete(key);
    setUrlParams(next, { replace: key !== 'os' });
    if (key !== 'os') table.resetPage();
  };

  const hasFilters = status.length || priority.length || type.length || technicianId || clientId;
  const clearFilters = () => {
    const next = new URLSearchParams();
    if (openId) next.set('os', openId);
    setUrlParams(next, { replace: true });
    table.resetPage();
  };

  const params = useMemo(
    () => ({
      ...table.params,
      status: status.join(',') || undefined,
      priority: priority.join(',') || undefined,
      type: type.join(',') || undefined,
      technicianId: technicianId || undefined,
      clientId: clientId || undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.params, urlParams]
  );

  const query = useQuery({
    queryKey: queryKeys.serviceOrders.list(params),
    queryFn: () => api.get('/service-orders', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const columns = [
    { field: 'orderNumber', headerName: 'Nº', width: 80, valueFormatter: (v) => `#${v}` },
    {
      field: 'title',
      headerName: 'OS',
      flex: 1.4,
      minWidth: 220,
      renderCell: ({ row }) => (
        <Box sx={{ py: 1, lineHeight: 1.3, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {row.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {row.client?.name}
            {row.company && row.company.name !== row.client?.name ? ` — ${row.company.name}` : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {formatAddress(row.address)}
          </Typography>
        </Box>
      ),
    },
    { field: 'type', headerName: 'Tipo', width: 130, valueFormatter: (v) => labelOf(SERVICE_ORDER_TYPE, v) },
    {
      field: 'technician',
      headerName: 'Técnico',
      width: 140,
      sortable: false,
      valueGetter: (v, row) => row.technician?.name || '—',
    },
    {
      field: 'schedule',
      headerName: 'Agendada',
      width: 130,
      sortable: false,
      valueGetter: (v, row) => {
        const s = row.schedules?.[0];
        return s ? `${formatDate(s.date)} ${s.time || labelOf(PERIOD, s.period) || ''}`.trim() : '—';
      },
    },
    { field: 'priority', headerName: 'Prioridade', width: 115, renderCell: ({ value }) => <StatusChip map={PRIORITY} value={value} /> },
    { field: 'status', headerName: 'Status', width: 135, renderCell: ({ value }) => <StatusChip map={SERVICE_ORDER_STATUS} value={value} /> },
    {
      field: 'totalValue',
      headerName: 'Valor',
      width: 150,
      renderCell: ({ row }) =>
        Number(row.totalValue) > 0 ? (
          <Box sx={{ py: 1, lineHeight: 1.3 }}>
            <Typography variant="body2">{formatCurrency(row.totalValue)}</Typography>
            <StatusChip map={PAYMENT_STATUS} value={row.paymentStatus} sx={{ height: 20, fontSize: 11 }} />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Ordens de Serviço"
        subtitle={query.data ? `${query.data.total} ordem(ns) encontrada(s)` : ' '}
        actions={
          isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              Nova OS
            </Button>
          )
        }
      />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Buscar nº, título, cliente, empresa, técnico ou endereço"
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
          sx={{ flex: '1 1 280px', maxWidth: 440 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <MultiSelect label="Status" value={status} options={SERVICE_ORDER_STATUS} onChange={(v) => setParam('status', v)} />
        <MultiSelect label="Prioridade" value={priority} options={PRIORITY} onChange={(v) => setParam('priority', v)} width={160} />
        <MultiSelect label="Tipo" value={type} options={SERVICE_ORDER_TYPE} onChange={(v) => setParam('type', v)} width={170} />
        <TextField
          select
          size="small"
          label="Técnico"
          sx={{ width: 180 }}
          value={technicians.data?.some((t) => t.id === technicianId) ? technicianId : ''}
          onChange={(e) => setParam('technicianId', e.target.value)}
        >
          <MenuItem value="">Todos</MenuItem>
          {(technicians.data || []).map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
            </MenuItem>
          ))}
        </TextField>
        {hasFilters ? (
          <Button size="small" startIcon={<FilterOffIcon />} onClick={clearFilters}>
            Limpar filtros
          </Button>
        ) : null}
      </Box>

      <ServerDataGrid
        query={query}
        columns={columns}
        getRowHeight={() => 'auto'}
        onRowClick={({ row }) => setParam('os', row.id)}
        sx={{ border: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        {...table.gridProps}
      />

      <ServiceOrderDrawer id={openId} onClose={() => setParam('os', '')} />
      <ServiceOrderFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(os) => setParam('os', os.id)} />
    </>
  );
}
