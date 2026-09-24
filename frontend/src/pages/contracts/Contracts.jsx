import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Box, Button, Checkbox, InputAdornment, ListItemText, MenuItem, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import api from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import ServerDataGrid from '../../components/common/ServerDataGrid';
import StatusChip from '../../components/common/StatusChip';
import useServerTable from '../../hooks/useServerTable';
import { queryKeys } from '../../lib/queryKeys';
import { CONTRACT_STATUS, PERIODICITY, labelOf } from '../../constants/labels';
import { formatCurrency, formatDate } from '../../utils/format';
import { formatAddress } from '../../utils/address';
import ContractDrawer from './ContractDrawer';
import ContractFormDialog from './ContractFormDialog';
import GenerateBatchDialog from './GenerateBatchDialog';

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default function Contracts() {
  const [urlParams, setUrlParams] = useSearchParams();
  const table = useServerTable({ sort: 'createdAt', order: 'desc' });
  const [creating, setCreating] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  const statusParam = urlParams.get('status');
  // Padrão: ativos e suspensos
  const status = (statusParam ?? 'ACTIVE,SUSPENDED').split(',').filter((s) => CONTRACT_STATUS[s]);
  const openId = UUID_RE.test(urlParams.get('contrato') || '') ? urlParams.get('contrato') : null;

  const setParam = (key, value) => {
    const next = new URLSearchParams(urlParams);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setUrlParams(next, { replace: key !== 'contrato' });
    if (key !== 'contrato') table.resetPage();
  };

  const params = useMemo(() => ({ ...table.params, status: status.join(',') || undefined }), [table.params, statusParam]); // eslint-disable-line react-hooks/exhaustive-deps
  const query = useQuery({
    queryKey: queryKeys.contracts.list(params),
    queryFn: () => api.get('/contracts', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const columns = [
    {
      field: 'client',
      headerName: 'Cliente / Empresa',
      flex: 1.4,
      minWidth: 220,
      renderCell: ({ row }) => (
        <Box sx={{ py: 1, lineHeight: 1.3, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {row.company?.name || row.client?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {row.client?.name}
            {row.address ? ` · ${formatAddress(row.address)}` : ''}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'monthlyValue',
      headerName: 'Valor',
      width: 170,
      renderCell: ({ row }) => (
        <Box sx={{ py: 1, lineHeight: 1.3 }}>
          <Typography variant="body2">{formatCurrency(row.monthlyValue)}/mês</Typography>
          <Typography variant="caption" color="text.secondary">
            {labelOf(PERIODICITY, row.periodicity)}
          </Typography>
        </Box>
      ),
    },
    { field: 'dueDay', headerName: 'Vence dia', width: 95 },
    {
      field: 'startDate',
      headerName: 'Vigência',
      width: 190,
      valueGetter: (v, row) => `${formatDate(row.startDate)}${row.endDate ? ` a ${formatDate(row.endDate)}` : ''}`,
    },
    { field: 'status', headerName: 'Status', width: 120, sortable: false, renderCell: ({ value }) => <StatusChip map={CONTRACT_STATUS} value={value} /> },
    { field: 'payments', headerName: 'Cobranças', width: 100, sortable: false, valueGetter: (v, row) => row._count?.monthlyPayments ?? 0 },
  ];

  return (
    <>
      <PageHeader
        title="Contratos"
        subtitle={query.data ? `${query.data.total} contrato(s)` : ' '}
        actions={
          <>
            <Button startIcon={<ReceiptIcon />} onClick={() => setBatchOpen(true)}>
              Gerar cobranças do mês
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              Novo contrato
            </Button>
          </>
        }
      />
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Buscar cliente ou empresa"
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
          sx={{ flex: '1 1 260px', maxWidth: 400 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <TextField
          select
          size="small"
          label="Status"
          sx={{ width: 220 }}
          SelectProps={{
            multiple: true,
            value: status,
            displayEmpty: true,
            onChange: (e) => setParam('status', e.target.value.join(',')),
            renderValue: (sel) => (sel.length === 0 ? 'Todos' : sel.map((s) => CONTRACT_STATUS[s].label).join(', ')),
          }}
          InputLabelProps={{ shrink: true }}
        >
          {Object.entries(CONTRACT_STATUS).map(([k, v]) => (
            <MenuItem key={k} value={k}>
              <Checkbox size="small" checked={status.includes(k)} />
              <ListItemText primary={v.label} />
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <ServerDataGrid
        query={query}
        columns={columns}
        getRowHeight={() => 'auto'}
        onRowClick={({ row }) => setParam('contrato', row.id)}
        sx={{ border: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        {...table.gridProps}
      />
      <ContractDrawer id={openId} onClose={() => setParam('contrato', null)} />
      <ContractFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(c) => setParam('contrato', c.id)} />
      <GenerateBatchDialog open={batchOpen} onClose={() => setBatchOpen(false)} />
    </>
  );
}
