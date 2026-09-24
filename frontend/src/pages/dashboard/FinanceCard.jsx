import { useNavigate } from 'react-router-dom';
import { Alert, Box, ButtonBase, Skeleton, Typography } from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import SectionCard from '../../components/common/SectionCard';
import { formatCurrency, formatNumber } from '../../utils/format';
import { useFinanceSummary } from './useDashboardData';

function Row({ label, count, amount, color, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      focusRipple
      sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 1.25,
        borderRadius: 2,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
        <Typography variant="body2" fontWeight={600}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ({formatNumber(count)})
        </Typography>
      </Box>
      <Typography variant="body2" fontWeight={700}>
        {formatCurrency(amount)}
      </Typography>
    </ButtonBase>
  );
}

export default function FinanceCard({ month }) {
  const q = useFinanceSummary(month);
  const navigate = useNavigate();
  const d = q.data;

  return (
    <SectionCard
      title="Financeiro"
      subtitle="Cobranças com vencimento no mês"
      icon={<AccountBalanceIcon color="primary" />}
      loading={q.isLoading}
      error={q.isError && !d ? q.error : null}
      onRetry={q.refetch}
      skeleton={
        <Box>
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </Box>
      }
    >
      {d && (
        <>
          <Row label="Pagas" count={d.paidCount} amount={d.paidAmount} color="success.main" onClick={() => navigate(`/financeiro?status=PAID&mes=${month}`)} />
          <Row label="Pendentes" count={d.pendingCount} amount={d.pendingAmount} color="warning.main" onClick={() => navigate(`/financeiro?status=PENDING&mes=${month}`)} />
          <Row label="Atrasadas" count={d.overdueCount} amount={d.overdueAmount} color="error.main" onClick={() => navigate(`/financeiro?status=OVERDUE&mes=${month}`)} />
          {d.overdueTotalCount > d.overdueCount && (
            <Alert severity="error" variant="outlined" sx={{ mt: 1.5, py: 0 }}>
              Total em atraso (todos os meses): <strong>{formatCurrency(d.overdueTotal)}</strong> em {d.overdueTotalCount} cobrança(s).
            </Alert>
          )}
        </>
      )}
    </SectionCard>
  );
}
