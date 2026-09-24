import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Chip, Grid, LinearProgress, Skeleton, Typography } from '@mui/material';
import BuildIcon from '@mui/icons-material/BuildOutlined';
import SectionCard from '../../components/common/SectionCard';
import { formatNumber, formatPercent } from '../../utils/format';
import { useOperations } from './useDashboardData';

function StatTile({ label, hint, value, color, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      focusRipple
      sx={{
        width: '100%',
        display: 'block',
        textAlign: 'left',
        p: 1.5,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        transition: 'background-color .15s ease',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Typography variant="h5" fontWeight={700} color={color}>
        {formatNumber(value)}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {hint}
      </Typography>
    </ButtonBase>
  );
}

export default function OperationsCard({ month }) {
  const q = useOperations(month);
  const navigate = useNavigate();
  const d = q.data;

  return (
    <SectionCard
      title="Operação"
      subtitle="Ordens de serviço"
      icon={<BuildIcon color="primary" />}
      action={d?.urgent ? <Chip size="small" color="error" label={`${d.urgent} urgente(s)`} onClick={() => navigate('/ordens-servico?priority=URGENT&status=OPEN,IN_PROGRESS')} /> : null}
      loading={q.isLoading}
      error={q.isError && !d ? q.error : null}
      onRetry={q.refetch}
      skeleton={
        <Grid container spacing={1.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={6} key={i}>
              <Skeleton variant="rounded" height={86} />
            </Grid>
          ))}
        </Grid>
      }
    >
      {d && (
        <>
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <StatTile label="Abertas" hint="agora" value={d.status.open} color="info.main" onClick={() => navigate('/ordens-servico?status=OPEN')} />
            </Grid>
            <Grid item xs={6}>
              <StatTile label="Em andamento" hint="agora" value={d.status.inProgress} color="warning.main" onClick={() => navigate('/ordens-servico?status=IN_PROGRESS')} />
            </Grid>
            <Grid item xs={6}>
              <StatTile label="Concluídas" hint="no mês" value={d.status.completed} color="success.main" onClick={() => navigate('/ordens-servico?status=COMPLETED')} />
            </Grid>
            <Grid item xs={6}>
              <StatTile label="Canceladas" hint="no mês" value={d.status.cancelled} color="text.secondary" onClick={() => navigate('/ordens-servico?status=CANCELLED')} />
            </Grid>
          </Grid>

          <Typography variant="body2" fontWeight={700} sx={{ mt: 2.5, mb: 1 }}>
            Abertas no mês por tipo ({formatNumber(d.createdInMonth)})
          </Typography>
          {d.createdInMonth === 0 ? (
            <Typography variant="caption" color="text.secondary">
              Nenhuma OS aberta neste mês.
            </Typography>
          ) : (
            d.byType
              .filter((t) => t.count > 0)
              .map((t) => (
                <Box key={t.type} sx={{ mb: 1.25 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography variant="caption" fontWeight={600}>
                      {t.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.count} · {formatPercent(t.percent)}
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={t.percent} sx={{ height: 8, borderRadius: 4 }} />
                </Box>
              ))
          )}
        </>
      )}
    </SectionCard>
  );
}
