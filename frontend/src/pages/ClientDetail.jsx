import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Avatar,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ApartmentIcon from '@mui/icons-material/ApartmentOutlined';
import BadgeIcon from '@mui/icons-material/BadgeOutlined';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import EmailIcon from '@mui/icons-material/EmailOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import RouterIcon from '@mui/icons-material/RouterOutlined';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import PaidIcon from '@mui/icons-material/PaidOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import api from '../services/api';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatusChip from '../components/StatusChip';
import { currency, initials } from '../utils/format';

const emptyCompanyForm = {
  name: '',
  cnpj: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
};

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
      <Icon fontSize="small" sx={{ color: 'text.secondary', mt: 0.25 }} />
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyCompanyForm);

  async function load() {
    setLoading(true);
    const res = await api.get(`/clients/${id}`);
    setClient(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSaveCompany() {
    await api.post('/companies', { ...form, clientId: id });
    setOpen(false);
    setForm(emptyCompanyForm);
    load();
  }

  if (loading || !client) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={client.name}
        subtitle={`${client.documentType}: ${client.document}`}
        onBack={() => navigate('/clientes')}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Nova Empresa
          </Button>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={4}>
          <SectionCard icon={PersonIcon} title="Dados do Cliente" subtitle="Informações cadastrais">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.light', color: 'primary.dark', fontSize: 20 }}>
                {initials(client.name)}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {client.name}
                </Typography>
                <Chip
                  size="small"
                  label={client.active ? 'Ativo' : 'Inativo'}
                  color={client.active ? 'success' : 'default'}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Box>

            <InfoRow icon={BadgeIcon} label={client.documentType} value={client.document} />
            <InfoRow icon={PhoneIcon} label="Telefone" value={client.phone} />
            <InfoRow icon={EmailIcon} label="E-mail" value={client.email} />
            <InfoRow
              icon={PlaceIcon}
              label="Endereço"
              value={[client.address, client.city, client.state].filter(Boolean).join(', ') || null}
            />
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={8}>
          <SectionCard
            icon={ApartmentIcon}
            title="Empresas"
            subtitle={`${client.companies.length} empresa(s) vinculada(s) a este cliente`}
          >
            {client.companies.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nenhuma empresa cadastrada ainda. Use "Nova Empresa" para adicionar a primeira.
              </Typography>
            )}
            <Grid container spacing={2}>
              {client.companies.map((company) => (
                <Grid item xs={12} sm={6} key={company.id}>
                  <Box
                    onClick={() => navigate(`/empresas/${company.id}`)}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      height: '100%',
                      '&:hover': { borderColor: 'primary.main', boxShadow: 3, transform: 'translateY(-2px)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ pr: 1 }}>
                        {company.name}
                      </Typography>
                      <StatusChip status={company.status} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                      CNPJ: {company.cnpj}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <RouterIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        <Typography variant="caption">{company.equipmentCount} equip.</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AssignmentIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        <Typography variant="caption">{company.serviceOrderCount} OS</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PaidIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        <Typography variant="caption">{currency(company.recurringMonthly)}/mês</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </SectionCard>
        </Grid>
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nova Empresa</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Nome da empresa"
            fullWidth
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="CNPJ"
            fullWidth
            value={form.cnpj}
            onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
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
          </Box>
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
          <Button variant="contained" onClick={handleSaveCompany}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
