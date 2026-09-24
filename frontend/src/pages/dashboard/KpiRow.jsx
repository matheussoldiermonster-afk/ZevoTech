import { Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PaidIcon from '@mui/icons-material/PaidOutlined';
import SavingsIcon from '@mui/icons-material/SavingsOutlined';
import HourglassIcon from '@mui/icons-material/HourglassBottomOutlined';
import GroupsIcon from '@mui/icons-material/GroupsOutlined';
import KpiCard from '../../components/common/KpiCard';
import { formatCurrency, formatNumber } from '../../utils/format';
import { useKpis } from './useDashboardData';

export default function KpiRow({ month }) {
  const q = useKpis(month);
  const navigate = useNavigate();
  const d = q.data;
  const common = { loading: q.isLoading, error: q.isError && !d ? q.error : null, onRetry: q.refetch };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} lg={3}>
        <KpiCard
          {...common}
          title="Faturamento previsto"
          icon={<PaidIcon />}
          value={formatCurrency(d?.billing.value)}
          change={d?.billing.change}
          footer={d && `${d.billing.count} cobrança(s) no mês`}
        />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <KpiCard
          {...common}
          title="Recebido"
          icon={<SavingsIcon />}
          accent="success.main"
          value={formatCurrency(d?.received.value)}
          change={d?.received.change}
          onClick={() => navigate(`/financeiro?status=PAID&pagoEm=${month}`)}
        />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <KpiCard
          {...common}
          title="Em aberto"
          icon={<HourglassIcon />}
          accent="warning.main"
          value={formatCurrency(d?.open.value)}
          change={d?.open.change}
          invertTrend
          onClick={() => navigate(`/financeiro?status=OPEN&mes=${month}`)}
        />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <KpiCard
          {...common}
          title="Clientes ativos"
          icon={<GroupsIcon />}
          value={formatNumber(d?.clients.active)}
          footer={d && `+${formatNumber(d.clients.newInMonth)} novo(s) no mês`}
          onClick={() => navigate('/clientes')}
        />
      </Grid>
    </Grid>
  );
}
