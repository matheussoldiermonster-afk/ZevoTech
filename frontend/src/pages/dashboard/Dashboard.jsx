import { useSearchParams } from 'react-router-dom';
import { Grid } from '@mui/material';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../contexts/AuthContext';
import { currentMonthISO, firstName, formatMonth, greeting } from '../../utils/format';
import MonthSelector from './MonthSelector';
import KpiRow from './KpiRow';
import RevenueChartCard from './RevenueChartCard';
import AlertsCard from './AlertsCard';
import OperationsCard from './OperationsCard';
import TodayAgendaCard from './TodayAgendaCard';
import FinanceCard from './FinanceCard';
import EquipmentCard from './EquipmentCard';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default function Dashboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const month = MONTH_RE.test(params.get('mes') || '') ? params.get('mes') : currentMonthISO();

  const setMonth = (m) => {
    const next = new URLSearchParams(params);
    if (m === currentMonthISO()) next.delete('mes');
    else next.set('mes', m);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title={`${greeting()}${user?.name ? `, ${firstName(user.name)}` : ''}!`}
        subtitle={`Resumo de ${formatMonth(month).toLowerCase()}`}
        actions={<MonthSelector value={month} onChange={setMonth} />}
      />

      {/* Cada bloco carrega de forma independente e em paralelo */}
      <KpiRow month={month} />

      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12} lg={8}>
          <RevenueChartCard key={month} month={month} />
        </Grid>
        <Grid item xs={12} lg={4}>
          <AlertsCard />
        </Grid>

        <Grid item xs={12} md={6} xl={3}>
          <OperationsCard month={month} />
        </Grid>
        <Grid item xs={12} md={6} xl={3}>
          <TodayAgendaCard />
        </Grid>
        <Grid item xs={12} md={6} xl={3}>
          <FinanceCard month={month} />
        </Grid>
        <Grid item xs={12} md={6} xl={3}>
          <EquipmentCard />
        </Grid>
      </Grid>
    </>
  );
}
