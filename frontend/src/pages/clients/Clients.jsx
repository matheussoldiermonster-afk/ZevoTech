import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Box, Button, Chip, FormControlLabel, InputAdornment, Switch, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import api from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import ServerDataGrid from '../../components/common/ServerDataGrid';
import useServerTable from '../../hooks/useServerTable';
import { useAuth } from '../../contexts/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import { formatDocument, formatPhone } from '../../utils/document';
import { formatDateTime } from '../../utils/format';
import ClientFormDialog from './ClientFormDialog';

export default function Clients() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const table = useServerTable({ sort: 'name', order: 'asc' });
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState(false);

  const params = useMemo(() => ({ ...table.params, includeInactive: showInactive || undefined }), [table.params, showInactive]);
  const query = useQuery({
    queryKey: queryKeys.clients.list(params),
    queryFn: () => api.get('/clients', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const columns = [
    {
      field: 'name',
      headerName: 'Cliente',
      flex: 1.5,
      minWidth: 220,
      renderCell: ({ row }) => (
        <Box sx={{ py: 1, lineHeight: 1.3, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {row.name} {!row.active && <Chip size="small" label="inativo" sx={{ ml: 0.5, height: 18 }} />}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.documentType} {formatDocument(row.document)}
          </Typography>
        </Box>
      ),
    },
    { field: 'phone', headerName: 'Telefone', width: 150, sortable: false, valueFormatter: (v) => formatPhone(v) },
    { field: 'email', headerName: 'E-mail', flex: 1, minWidth: 180, sortable: false, valueFormatter: (v) => v || '—' },
    { field: 'companies', headerName: 'Empresas', width: 100, sortable: false, valueGetter: (v, row) => row._count?.companies ?? 0 },
    { field: 'orders', headerName: 'OS', width: 80, sortable: false, valueGetter: (v, row) => row._count?.serviceOrders ?? 0 },
    { field: 'contracts', headerName: 'Contratos', width: 100, sortable: false, valueGetter: (v, row) => row._count?.contracts ?? 0 },
    { field: 'createdAt', headerName: 'Cadastro', width: 150, valueFormatter: (v) => formatDateTime(v).slice(0, 10) },
  ];

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={query.data ? `${query.data.total} cliente(s)` : ' '}
        actions={
          isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              Novo cliente
            </Button>
          )
        }
      />
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Buscar por nome, documento, telefone, empresa ou endereço"
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
          sx={{ flex: '1 1 300px', maxWidth: 480 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={showInactive}
              onChange={(e) => {
                setShowInactive(e.target.checked);
                table.resetPage();
              }}
            />
          }
          label="Mostrar inativos"
        />
      </Box>
      <ServerDataGrid
        query={query}
        columns={columns}
        getRowHeight={() => 'auto'}
        onRowClick={({ row }) => navigate(`/clientes/${row.id}`)}
        sx={{ border: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        {...table.gridProps}
      />
      <ClientFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(c) => navigate(`/clientes/${c.id}`)} />
    </>
  );
}
