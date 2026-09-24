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
  IN_STOCK: { label: 'Em estoque', color: 'default' },
  INSTALLED: { label: 'Instalado', color: 'success' },
  MAINTENANCE: { label: 'Manutenção', color: 'warning' },
  DAMAGED: { label: 'Danificado', color: 'error' },
  DISCARDED: { label: 'Descartado', color: 'default' },
};

const emptyForm = { equipmentTypeId: '', clientId: '', serialNumber: '', status: 'IN_STOCK' };
const emptyTypeForm = { name: '', category: '', model: '', minimumStock: 0 };

export default function Equipment() {
  const [equipments, setEquipments] = useState([]);
  const [types, setTypes] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [openType, setOpenType] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [typeForm, setTypeForm] = useState(emptyTypeForm);

  async function loadData() {
    setLoading(true);
    const [equipRes, typesRes, clientsRes] = await Promise.all([
      api.get('/equipments'),
      api.get('/equipment-types'),
      api.get('/clients'),
    ]);
    setEquipments(equipRes.data);
    setTypes(typesRes.data);
    setClients(clientsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSave() {
    await api.post('/equipments', { ...form, clientId: form.clientId || null });
    setOpen(false);
    setForm(emptyForm);
    loadData();
  }

  async function handleSaveType() {
    await api.post('/equipment-types', { ...typeForm, minimumStock: Number(typeForm.minimumStock) });
    setOpenType(false);
    setTypeForm(emptyTypeForm);
    loadData();
  }

  const columns = [
    {
      field: 'equipmentType',
      headerName: 'Tipo',
      flex: 1,
      valueGetter: (value, row) => row.equipmentType?.name,
    },
    { field: 'serialNumber', headerName: 'Nº de série', flex: 0.9 },
    {
      field: 'client',
      headerName: 'Cliente',
      flex: 1,
      valueGetter: (value, row) => row.client?.name || '—',
    },
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
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Equipamentos
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={() => setOpenType(true)}>
            Novo Tipo
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Novo Equipamento
          </Button>
        </Box>
      </Box>

      <Paper sx={{ height: 520 }}>
        <DataGrid
          rows={equipments}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo Equipamento</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            select
            label="Tipo de equipamento"
            fullWidth
            value={form.equipmentTypeId}
            onChange={(e) => setForm({ ...form, equipmentTypeId: e.target.value })}
          >
            {types.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name} ({t.category})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Número de série"
            fullWidth
            value={form.serialNumber}
            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
          />
          <TextField
            select
            label="Cliente (opcional, se instalado)"
            fullWidth
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          >
            <MenuItem value="">—</MenuItem>
            {clients.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            fullWidth
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {Object.entries(statusConfig).map(([value, cfg]) => (
              <MenuItem key={value} value={value}>
                {cfg.label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openType} onClose={() => setOpenType(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo Tipo de Equipamento</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Nome"
            fullWidth
            value={typeForm.name}
            onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
          />
          <TextField
            label="Categoria"
            fullWidth
            value={typeForm.category}
            onChange={(e) => setTypeForm({ ...typeForm, category: e.target.value })}
          />
          <TextField
            label="Modelo"
            fullWidth
            value={typeForm.model}
            onChange={(e) => setTypeForm({ ...typeForm, model: e.target.value })}
          />
          <TextField
            label="Estoque mínimo"
            type="number"
            fullWidth
            value={typeForm.minimumStock}
            onChange={(e) => setTypeForm({ ...typeForm, minimumStock: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenType(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveType}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
