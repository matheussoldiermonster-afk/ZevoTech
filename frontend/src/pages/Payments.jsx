import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Chip, MenuItem, TextField } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import api from '../services/api';

const statusConfig = {
  PENDING: { label: 'Pendente', color: 'warning' },
  PAID: { label: 'Pago', color: 'success' },
  OVERDUE: { label: 'Atrasado', color: 'error' },
  CANCELLED: { label: 'Cancelado', color: 'default' },
};

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  async function loadPayments() {
    setLoading(true);
    const res = await api.get('/monthly-payments', { params: { status: statusFilter || undefined } });
    setPayments(res.data);
    setLoading(false);
  }

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function markAsPaid(id) {
    await api.put(`/monthly-payments/${id}`, { status: 'PAID' });
    loadPayments();
  }

  const columns = [
    {
      field: 'client',
      headerName: 'Cliente',
      flex: 1.2,
      valueGetter: (value, row) => row.contract?.client?.name,
    },
    {
      field: 'reference',
      headerName: 'Referência',
      flex: 0.7,
      valueFormatter: (value) => new Date(value).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    },
    {
      field: 'amount',
      headerName: 'Valor',
      flex: 0.7,
      valueFormatter: (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
    },
    {
      field: 'dueDate',
      headerName: 'Vencimento',
      flex: 0.7,
      valueFormatter: (value) => new Date(value).toLocaleDateString('pt-BR'),
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.7,
      renderCell: (params) => (
        <Chip
          size="small"
          label={statusConfig[params.value]?.label || params.value}
          color={statusConfig[params.value]?.color || 'default'}
          onClick={params.value === 'PENDING' ? () => markAsPaid(params.row.id) : undefined}
          clickable={params.value === 'PENDING'}
        />
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Pagamentos
        </Typography>
        <TextField
          select
          size="small"
          label="Status"
          sx={{ width: 200 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="PENDING">Pendente</MenuItem>
          <MenuItem value="PAID">Pago</MenuItem>
          <MenuItem value="OVERDUE">Atrasado</MenuItem>
          <MenuItem value="CANCELLED">Cancelado</MenuItem>
        </TextField>
      </Box>

      <Paper sx={{ height: 560 }}>
        <DataGrid
          rows={payments}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Cobranças recorrentes geradas a partir dos Contratos. Clique em "Pendente" para marcar como pago.
      </Typography>
    </Box>
  );
}
