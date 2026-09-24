import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Paper,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import api from '../services/api';

const emptyForm = {
  name: '',
  document: '',
  documentType: 'CNPJ',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
};

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');

  async function loadClients() {
    setLoading(true);
    const res = await api.get('/clients', { params: { search } });
    setClients(res.data);
    setLoading(false);
  }

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    await api.post('/clients', form);
    setOpen(false);
    setForm(emptyForm);
    loadClients();
  }

  const columns = [
    { field: 'name', headerName: 'Nome', flex: 1.5 },
    { field: 'document', headerName: 'CPF/CNPJ', flex: 1 },
    { field: 'phone', headerName: 'Telefone', flex: 1 },
    { field: 'email', headerName: 'E-mail', flex: 1.2 },
    { field: 'city', headerName: 'Cidade', flex: 0.8 },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Clientes
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Novo Cliente
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar por nome, documento ou telefone..."
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadClients()}
        />
      </Paper>

      <Paper sx={{ height: 520 }}>
        <DataGrid
          rows={clients}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo Cliente</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Nome"
            fullWidth
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              label="Tipo"
              sx={{ width: 140 }}
              value={form.documentType}
              onChange={(e) => setForm({ ...form, documentType: e.target.value })}
            >
              <MenuItem value="CPF">CPF</MenuItem>
              <MenuItem value="CNPJ">CNPJ</MenuItem>
            </TextField>
            <TextField
              label="Documento"
              fullWidth
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
            />
          </Box>
          <TextField
            label="Telefone"
            fullWidth
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <TextField
            label="E-mail"
            fullWidth
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            label="Endereço"
            fullWidth
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Cidade"
              fullWidth
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <TextField
              label="UF"
              sx={{ width: 100 }}
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </Box>
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
