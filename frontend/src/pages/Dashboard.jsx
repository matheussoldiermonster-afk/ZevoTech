import { useEffect, useState } from 'react';
import { Grid, Paper, Typography, Box, CircularProgress, Divider, Chip } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarTodayOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined';
import ApartmentIcon from '@mui/icons-material/ApartmentOutlined';
import PaidIcon from '@mui/icons-material/PaidOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import api from '../services/api';

const currency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function CardShell({ icon, title, children }) {
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {icon}
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
      </Box>
      {children}
    </Paper>
  );
}

function FaturamentoCard({ billing }) {
  return (
    <CardShell icon={<PaidIcon color="primary" />} title="Faturamento do Mês">
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
        {currency(billing?.total)}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          Recebido
        </Typography>
        <Typography variant="body2" fontWeight={600} color="success.main">
          {currency(billing?.received)}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          Em aberto
        </Typography>
        <Typography variant="body2" fontWeight={600} color="warning.main">
          {currency(billing?.pending)}
        </Typography>
      </Box>
    </CardShell>
  );
}

function AgendaCard({ schedule }) {
  return (
    <CardShell icon={<CalendarTodayIcon color="primary" />} title="Hoje">
      {schedule?.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Nenhum atendimento agendado para hoje.
        </Typography>
      )}
      {schedule?.map((item, idx) => (
        <Box key={idx}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
            <Typography variant="body2">
              <strong>{item.time}</strong> &nbsp;{item.type} — {item.clientName}
            </Typography>
          </Box>
          {idx < schedule.length - 1 && <Divider />}
        </Box>
      ))}
    </CardShell>
  );
}

function EstoqueCard({ stock }) {
  return (
    <CardShell icon={<Inventory2Icon color="primary" />} title="Estoque">
      {stock?.items.map((item, idx) => (
        <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
          <Typography variant="body2">{item.name}</Typography>
          <Typography variant="body2" fontWeight={600} color={item.belowMinimum ? 'error.main' : 'text.primary'}>
            {item.quantity}
          </Typography>
        </Box>
      ))}
      {stock?.lowStockCount > 0 && (
        <Chip
          size="small"
          sx={{ mt: 1.5 }}
          icon={<WarningAmberIcon />}
          label={`${stock.lowStockCount} ${stock.lowStockCount === 1 ? 'item abaixo' : 'itens abaixo'} do mínimo`}
          color="warning"
        />
      )}
    </CardShell>
  );
}

function EmpresasCard({ companies }) {
  return (
    <CardShell icon={<ApartmentIcon color="primary" />} title="Empresas">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          Ativas
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {companies?.active}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          Equipamentos instalados
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {companies?.equipmentInstalled}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          Receita recorrente
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {currency(companies?.recurringRevenue)}
        </Typography>
      </Box>
    </CardShell>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/dashboard/summary')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FaturamentoCard billing={data?.billing} />
        </Grid>
        <Grid item xs={12} md={6}>
          <AgendaCard schedule={data?.schedule} />
        </Grid>
        <Grid item xs={12} md={6}>
          <EstoqueCard stock={data?.stock} />
        </Grid>
        <Grid item xs={12} md={6}>
          <EmpresasCard companies={data?.companies} />
        </Grid>
      </Grid>
    </Box>
  );
}
