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
import api from '../services/api';

const statusConfig = {
  OPEN: { label: 'Aberta', color: 'info' },
  IN_PROGRESS: { label: 'Em andamento', color: 'warning' },
  COMPLETED: { label: 'Concluída', color: 'success' },
  CANCELLED: { label: 'Cancelada', color: 'default' },
};

const typeLabels = {
  INSTALLATION: 'Instalação',
  CORRECTIVE: 'Corretiva',
  PREVENTIVE: 'Preventiva',
  KIT_REMOVAL: 'Retirada de Kit',
  OTHER: 'Outro',
};

const priorityLabels = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

const periodLabels = {
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  EVENING: 'Noite',
};

const paymentStatusConfig = {
  PENDING: { label: 'Pendente', color: 'warning' },
  PAID: { label: 'Pago', color: 'success' },
  OVERDUE: { label: 'Atrasado', color: 'error' },
  CANCELLED: { label: 'Cancelado', color: 'default' },
};

const emptyForm = {
  clientId: '',
  title: '',
  description: '',
  type: 'INSTALLATION',
  priority: 'NORMAL',
  scheduledDate: '',
  period: '',
  items: [],
};

export default function ServiceOrders() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [itemDraft, setItemDraft] = useState({ description: '', quantity: 1, unitValue: 0 });

  async function loadData() {
    setLoading(true);
    const [ordersRes, clientsRes] = await Promise.all([
      api.get('/service-orders'),
      api.get('/clients'),
    ]);
    setOrders(ordersRes.data);
    setClients(clientsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function addItem() {
    if (!itemDraft.description) return;
    setForm({ ...form, items: [...form.items, itemDraft] });
    setItemDraft({ description: '', quantity: 1, unitValue: 0 });
  }

  async function handleSave() {
    const payload = { ...form, scheduledDate: form.scheduledDate || undefined, period: form.period || undefined };
    await api.post('/service-orders', payload);
    setOpen(false);
    setForm(emptyForm);
    loadData();
  }

  async function markAsPaid(id) {
    await api.patch(`/service-orders/${id}/payment`, { paymentStatus: 'PAID' });
    loadData();
  }

  const columns = [
    { field: 'orderNumber', headerName: 'Nº', width: 70 },
    { field: 'title', headerName: 'Título', flex: 1.1 },
    {
      field: 'client',
      headerName: 'Cliente',
      flex: 1,
      valueGetter: (value, row) => row.client?.name,
    },
    { field: 'type', headerName: 'Tipo', flex: 0.8, valueFormatter: (value) => typeLabels[value] || value },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.8,
      renderCell: (params) => (
        <Chip
          size="small"
          label={statusConfig[params.value]?.label || params.value}
          color={statusConfig[params.value]?.color || 'default'}
        />
      ),
    },
    {
      field: 'totalValue',
      headerName: 'Valor',
      flex: 0.7,
      valueFormatter: (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
    },
    {
      field: 'paymentStatus',
      headerName: 'Pagamento',
      flex: 0.8,
      renderCell: (params) => (
        <Chip
          size="small"
          label={paymentStatusConfig[params.value]?.label || params.value}
          color={paymentStatusConfig[params.value]?.color || 'default'}
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
          Ordens de Serviço
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Nova OS
        </Button>
      </Box>

      <Paper sx={{ height: 560 }}>
        <DataGrid
          rows={orders}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Dica: clique em um status de pagamento "Pendente" para marcar como pago.
      </Typography>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nova Ordem de Serviço</DialogTitle>
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
          <TextField
            label="Título"
            fullWidth
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextField
            label="Descrição"
            fullWidth
            multiline
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              label="Tipo"
              fullWidth
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Prioridade"
              fullWidth
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {Object.entries(priorityLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Data agendada"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
            />
            <TextField
              select
              label="Período"
              fullWidth
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            >
              <MenuItem value="">—</MenuItem>
              {Object.entries(periodLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Typography variant="subtitle2">Itens/Serviços</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Descrição"
              size="small"
              fullWidth
              value={itemDraft.description}
              onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })}
            />
            <TextField
              label="Qtd"
              size="small"
              type="number"
              sx={{ width: 80 }}
              value={itemDraft.quantity}
              onChange={(e) => setItemDraft({ ...itemDraft, quantity: Number(e.target.value) })}
            />
            <TextField
              label="Valor unit."
              size="small"
              type="number"
              sx={{ width: 110 }}
              value={itemDraft.unitValue}
              onChange={(e) => setItemDraft({ ...itemDraft, unitValue: Number(e.target.value) })}
            />
            <Button onClick={addItem}>Add</Button>
          </Box>

          {form.items.map((item, idx) => (
            <Typography key={idx} variant="body2" color="text.secondary">
              {item.quantity}x {item.description} —{' '}
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                item.quantity * item.unitValue
              )}
            </Typography>
          ))}
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
