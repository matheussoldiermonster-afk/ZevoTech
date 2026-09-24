import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import { enqueueSnackbar } from 'notistack';
import { useQueryClient } from '@tanstack/react-query';
import api, { getErrorMessage } from '../services/api';
import { currentMonthISO, formatMonth } from '../utils/format';

const emptyForm = { clientId: '', monthlyValue: '', dueDay: 10, startDate: '' };

export default function Contracts() {
  const queryClient = useQueryClient();
  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function loadData() {
    setLoading(true);
    const [contractsRes, clientsRes] = await Promise.all([
      api.get('/contracts'),
      api.get('/clients'),
    ]);
    setContracts(contractsRes.data);
    setClients(clientsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSave() {
    await api.post('/contracts', {
      ...form,
      monthlyValue: Number(form.monthlyValue),
      dueDay: Number(form.dueDay),
    });
    setOpen(false);
    setForm(emptyForm);
    loadData();
  }

  async function generateCurrentMonth(id) {
    // Mês corrente no fuso de Brasília (antes usava o relógio local do navegador)
    const reference = currentMonthISO();
    try {
      await api.post(`/contracts/${id}/generate-payment`, { reference });
      enqueueSnackbar(`Cobrança de ${formatMonth(reference).toLowerCase()} gerada.`, { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      loadData();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err, 'Não foi possível gerar a cobrança.'), { variant: 'error' });
    }
  }

  const columns = [
    {
      field: 'client',
      headerName: 'Cliente',
      flex: 1.2,
      valueGetter: (value, row) => row.client?.name,
    },
    {
      field: 'monthlyValue',
      headerName: 'Valor mensal',
      flex: 0.8,
      valueFormatter: (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
    },
    { field: 'dueDay', headerName: 'Vencimento (dia)', flex: 0.8 },
    {
      field: 'active',
      headerName: 'Status',
      flex: 0.6,
      renderCell: (params) => (
        <Chip size="small" label={params.value ? 'Ativo' : 'Inativo'} color={params.value ? 'success' : 'default'} />
      ),
    },
    {
      field: 'actions',
      headerName: 'Cobrança do mês',
      flex: 1,
      sortable: false,
      renderCell: (params) => (
        <Button
          size="small"
          startIcon={<ReceiptIcon />}
          onClick={() => generateCurrentMonth(params.row.id)}
        >
          Gerar
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Contratos
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Novo Contrato
        </Button>
      </Box>

      <Paper sx={{ height: 520 }}>
        <DataGrid
          rows={contracts}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Use "Gerar" para criar a cobrança do mês atual em Pagamentos.
      </Typography>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo Contrato</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            select
            label="Cliente"
            fullWidth
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          >
            {clients.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Valor mensal"
              type="number"
              fullWidth
              value={form.monthlyValue}
              onChange={(e) => setForm({ ...form, monthlyValue: e.target.value })}
            />
            <TextField
              label="Dia de vencimento"
              type="number"
              sx={{ width: 160 }}
              value={form.dueDay}
              onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
            />
          </Box>
          <TextField
            label="Data de início"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
