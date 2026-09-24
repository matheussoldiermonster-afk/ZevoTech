import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Stack,
  Divider,
} from '@mui/material';
import ApartmentIcon from '@mui/icons-material/ApartmentOutlined';
import BadgeIcon from '@mui/icons-material/BadgeOutlined';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import EmailIcon from '@mui/icons-material/EmailOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import RouterIcon from '@mui/icons-material/RouterOutlined';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottomOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import api from '../services/api';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import StatusChip from '../components/StatusChip';
import { currency, formatDate, formatMonth } from '../utils/format';

const typeLabels = {
  INSTALLATION: 'Instalação',
  CORRECTIVE: 'Corretiva',
  PREVENTIVE: 'Preventiva',
  KIT_REMOVAL: 'Retirada de Kit',
  OTHER: 'Outro',
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

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/companies/${id}`)
      .then((res) => setCompany(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !company) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const fs = company.financialSummary;
  const allPayments = company.contracts.flatMap((c) =>
    c.monthlyPayments.map((p) => ({ ...p, contractValue: c.monthlyValue }))
  );

  return (
    <Box>
      <PageHeader
        title={company.name}
        subtitle={`CNPJ: ${company.cnpj}`}
        onBack={() => navigate(`/clientes/${company.client.id}`)}
        action={<StatusChip status={company.status} size="medium" />}
      />

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard icon={ApartmentIcon} tone="primary" label="Receita recorrente" value={currency(fs.recurringMonthly)} helperText="por mês" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard icon={AccountBalanceWalletIcon} tone="success" label="Pagamentos recebidos" value={currency(fs.paid)} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard icon={HourglassBottomIcon} tone="warning" label="Pendente" value={currency(fs.pending)} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard icon={ErrorOutlineIcon} tone="error" label="Em atraso" value={currency(fs.overdue)} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={4}>
          <SectionCard icon={PersonIcon} title="Dados da Empresa" subtitle="Cadastro e vínculo com o cliente">
            <InfoRow icon={BadgeIcon} label="CNPJ" value={company.cnpj} />
            <InfoRow icon={PhoneIcon} label="Telefone" value={company.phone} />
            <InfoRow icon={EmailIcon} label="E-mail" value={company.email} />
            <InfoRow
              icon={PlaceIcon}
              label="Endereço"
              value={[company.address, company.city, company.state].filter(Boolean).join(', ') || null}
            />
            <Divider sx={{ my: 1.5 }} />
            <InfoRow icon={PersonIcon} label="Cliente responsável" value={company.client.name} />
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={8}>
          <SectionCard
            icon={RouterIcon}
            title="Equipamentos"
            subtitle={`${company.equipments.length} equipamento(s) — ${fs.equipmentInstalled} instalado(s)`}
          >
            {company.equipments.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nenhum equipamento vinculado a esta empresa.
              </Typography>
            )}
            <Stack divider={<Divider />} spacing={1.25}>
              {company.equipments.map((eq) => (
                <Box key={eq.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {eq.equipmentType.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {eq.serialNumber || 'S/N —'} {eq.location ? `· ${eq.location}` : ''}
                    </Typography>
                  </Box>
                  <StatusChip status={eq.status} />
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <SectionCard
            icon={AssignmentIcon}
            title="Ordens de Serviço"
            subtitle={`${fs.openServiceOrders} em aberto/andamento`}
          >
            {company.serviceOrders.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nenhuma ordem de serviço registrada.
              </Typography>
            )}
            <Stack divider={<Divider />} spacing={1.25}>
              {company.serviceOrders.map((os) => (
                <Box key={os.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      #{os.orderNumber} · {os.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {typeLabels[os.type] || os.type} · {currency(os.totalValue)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <StatusChip status={os.status} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard
            icon={ReceiptLongIcon}
            title="Contratos e Pagamentos"
            subtitle={`${company.contracts.filter((c) => c.active).length} contrato(s) ativo(s)`}
          >
            {allPayments.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nenhuma cobrança gerada ainda para esta empresa.
              </Typography>
            )}
            <Stack divider={<Divider />} spacing={1.25}>
              {allPayments.slice(0, 8).map((p) => (
                <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                      {formatMonth(p.reference)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Vencimento: {formatDate(p.dueDate)}
                    </Typography>
                  </Box>
                  <StatusChip status={p.status} label={currency(p.amount)} />
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
