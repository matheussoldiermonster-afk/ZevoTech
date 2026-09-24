import { useMemo, useState } from 'react';
import { Box, Skeleton, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SectionCard from '../../components/common/SectionCard';
import EmptyState from '../../components/common/EmptyState';
import {
  compareMonthISO,
  formatCompactCurrency,
  formatCurrency,
  formatMonth,
  formatPercent,
  shiftMonthISO,
} from '../../utils/format';
import { useRevenueSeries } from './useDashboardData';

const MAX_MONTHS = 36;

function monthsBetween(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export default function RevenueChartCard({ month }) {
  const theme = useTheme();
  const [period, setPeriod] = useState('6');
  const [custom, setCustom] = useState(() => ({ from: shiftMonthISO(month, -11), to: month }));

  let from;
  let to;
  let rangeError = '';
  if (period === 'custom') {
    ({ from, to } = custom);
    if (!from || !to) rangeError = 'Informe o mês inicial e o final.';
    else if (compareMonthISO(from, to) > 0) rangeError = 'O mês inicial deve ser anterior ao final.';
    else if (monthsBetween(from, to) >= MAX_MONTHS) rangeError = `Selecione no máximo ${MAX_MONTHS} meses.`;
  } else {
    to = month;
    from = shiftMonthISO(month, -(Number(period) - 1));
  }

  const q = useRevenueSeries(from, to, !rangeError);
  const series = useMemo(() => q.data || [], [q.data]);
  const totals = useMemo(
    () => series.reduce((acc, s) => ({ expected: acc.expected + s.expected, received: acc.received + s.received }), { expected: 0, received: 0 }),
    [series]
  );
  const hasValues = series.some((s) => s.expected > 0 || s.received > 0);

  const controls = (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={period}
        onChange={(e, v) => v && setPeriod(v)}
        aria-label="Período do gráfico"
      >
        <ToggleButton value="6">6 meses</ToggleButton>
        <ToggleButton value="12">12 meses</ToggleButton>
        <ToggleButton value="custom">Personalizado</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );

  return (
    <SectionCard
      title="Previsto × Recebido"
      subtitle={rangeError ? undefined : `${formatMonth(from)} a ${formatMonth(to)}`}
      icon={<ShowChartIcon color="primary" />}
      action={controls}
      loading={q.isLoading && !rangeError}
      error={q.isError && !q.data ? q.error : null}
      onRetry={q.refetch}
      skeleton={<Skeleton variant="rounded" height={320} />}
    >
      {period === 'custom' && (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <TextField
            type="month"
            size="small"
            label="De"
            value={custom.from}
            onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            error={Boolean(rangeError)}
          />
          <TextField
            type="month"
            size="small"
            label="Até"
            value={custom.to}
            onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            error={Boolean(rangeError)}
            helperText={rangeError || ' '}
          />
        </Box>
      )}

      {rangeError ? null : !hasValues ? (
        <EmptyState title="Sem cobranças no período" description="Os valores aparecem aqui assim que houver cobranças." />
      ) : (
        <>
          <Box sx={{ width: '100%', height: 320 }}>
            <BarChart
              dataset={series}
              height={320}
              borderRadius={6}
              margin={{ left: 76, right: 12, top: 44, bottom: 30 }}
              xAxis={[
                {
                  scaleType: 'band',
                  dataKey: 'month',
                  valueFormatter: (m, ctx) => formatMonth(m, { short: ctx?.location === 'tick' }),
                },
              ]}
              yAxis={[{ valueFormatter: (v) => formatCompactCurrency(v) }]}
              series={[
                {
                  dataKey: 'expected',
                  label: 'Previsto',
                  color: theme.palette.primary.light,
                  valueFormatter: (v) => formatCurrency(v ?? 0),
                },
                {
                  dataKey: 'received',
                  label: 'Recebido',
                  color: theme.palette.secondary.dark,
                  valueFormatter: (v) => formatCurrency(v ?? 0),
                },
              ]}
              slotProps={{
                legend: { direction: 'row', position: { vertical: 'top', horizontal: 'right' }, padding: 0 },
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Total previsto: <strong>{formatCurrency(totals.expected)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total recebido: <strong>{formatCurrency(totals.received)}</strong>
            </Typography>
            {totals.expected > 0 && (
              <Typography variant="body2" color="text.secondary">
                Recebimento: <strong>{formatPercent((totals.received / totals.expected) * 100)}</strong>
              </Typography>
            )}
          </Box>
        </>
      )}
    </SectionCard>
  );
}
