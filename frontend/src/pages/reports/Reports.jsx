import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Box,
  Button,
  Grid,
  LinearProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import PdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ExcelIcon from '@mui/icons-material/GridOnOutlined';
import PaidIcon from '@mui/icons-material/PaidOutlined';
import BuildIcon from '@mui/icons-material/BuildOutlined';
import GroupsIcon from '@mui/icons-material/GroupsOutlined';
import RouterIcon from '@mui/icons-material/RouterOutlined';
import api, { getErrorMessage } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import ErrorState from '../../components/common/ErrorState';
import MonthSelector from '../dashboard/MonthSelector';
import { currentMonthISO, formatCurrency, formatDate, formatMonth, formatNumber, formatPercent } from '../../utils/format';
import { downloadFile, normalizeBlobError } from '../../utils/download';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function Metric({ label, value, hint, color }) {
  return (
    <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, height: '100%' }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700} color={color}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

function Metrics({ items }) {
  return (
    <Grid container spacing={1.5} sx={{ mb: 2 }}>
      {items.map((m) => (
        <Grid item xs={6} md={3} key={m.label}>
          <Metric {...m} />
        </Grid>
      ))}
    </Grid>
  );
}

function SimpleTable({ columns, rows, empty = 'Sem registros.' }) {
  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {empty}
      </Typography>
    );
  }
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell key={c.label} align={c.align} sx={{ fontWeight: 700 }}>
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((cell, j) => (
                <TableCell key={j} align={columns[j].align}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

const trend = (v) => (v === null ? 'sem base no mês anterior' : `${formatPercent(v, { signed: true })} vs. mês anterior`);

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const month = MONTH_RE.test(params.get('mes') || '') ? params.get('mes') : currentMonthISO();
  const [exporting, setExporting] = useState(null);

  const q = useQuery({
    queryKey: ['reports', 'monthly', month],
    queryFn: () => api.get('/reports/monthly', { params: { month } }).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
  const r = q.data;

  async function exportFile(format) {
    setExporting(format);
    try {
      await downloadFile(`/reports/monthly/${format}`, { month }, `relatorio-zevo-${month}.${format}`);
      enqueueSnackbar(`Relatório em ${format === 'pdf' ? 'PDF' : 'Excel'} gerado.`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(await normalizeBlobError(err)), { variant: 'error' });
    } finally {
      setExporting(null);
    }
  }

  const setMonth = (m) => setParams(m === currentMonthISO() ? {} : { mes: m }, { replace: true });

  return (
    <>
      <PageHeader
        title="Relatório gerencial"
        subtitle={formatMonth(month)}
        actions={
          <>
            <MonthSelector value={month} onChange={setMonth} />
            <Button variant="outlined" startIcon={<PdfIcon />} onClick={() => exportFile('pdf')} disabled={Boolean(exporting)}>
              {exporting === 'pdf' ? 'Gerando…' : 'PDF'}
            </Button>
            <Button variant="outlined" startIcon={<ExcelIcon />} onClick={() => exportFile('xlsx')} disabled={Boolean(exporting)}>
              {exporting === 'xlsx' ? 'Gerando…' : 'Excel'}
            </Button>
          </>
        }
      />
      {exporting && <LinearProgress sx={{ mb: 2 }} />}

      {q.isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} lg={6} key={i}>
              <Skeleton variant="rounded" height={260} />
            </Grid>
          ))}
        </Grid>
      ) : q.isError && !r ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} lg={6}>
            <SectionCard title="Financeiro" icon={<PaidIcon color="primary" />}>
              <Metrics
                items={[
                  { label: 'Previsto', value: formatCurrency(r.finance.expected), hint: trend(r.finance.changes.expected) },
                  { label: 'Recebido', value: formatCurrency(r.finance.received), hint: trend(r.finance.changes.received), color: 'success.main' },
                  { label: 'Em aberto no mês', value: formatCurrency(r.finance.open), color: 'warning.main' },
                  { label: 'Em atraso (total)', value: formatCurrency(r.finance.overdueTotal), hint: `${r.finance.overdueTotalCount} cobrança(s)`, color: r.finance.overdueTotal ? 'error.main' : undefined },
                  { label: 'Receita recorrente', value: formatCurrency(r.finance.recurringRevenue), hint: `${r.finance.activeContracts} contrato(s) ativo(s)` },
                  { label: 'Taxa de recebimento', value: r.finance.receivedRate === null ? '—' : formatPercent(r.finance.receivedRate) },
                ]}
              />
              <SimpleTable
                columns={[{ label: 'Cobranças do mês' }, { label: 'Qtd.', align: 'right' }, { label: 'Valor', align: 'right' }]}
                rows={r.finance.byStatus.map((s) => [s.label, s.count, formatCurrency(s.amount)])}
              />
            </SectionCard>
          </Grid>

          <Grid item xs={12} lg={6}>
            <SectionCard title="Operação" icon={<BuildIcon color="primary" />}>
              <Metrics
                items={[
                  { label: 'OS abertas no mês', value: formatNumber(r.operations.created) },
                  { label: 'Concluídas', value: formatNumber(r.operations.completed), color: 'success.main' },
                  { label: 'Canceladas', value: formatNumber(r.operations.cancelled) },
                  {
                    label: 'Tempo médio de conclusão',
                    value: r.operations.avgResolutionDays === null ? '—' : `${String(r.operations.avgResolutionDays).replace('.', ',')} dia(s)`,
                  },
                ]}
              />
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
                Em aberto hoje: {r.operations.backlog.open} aberta(s) e {r.operations.backlog.inProgress} em andamento.
              </Typography>
              <SimpleTable
                columns={[{ label: 'Tipo' }, { label: 'Qtd.', align: 'right' }, { label: '%', align: 'right' }]}
                rows={r.operations.byType.filter((t) => t.count).map((t) => [t.label, t.count, formatPercent(t.percent)])}
                empty="Nenhuma OS aberta no mês."
              />
              <Box sx={{ mt: 2 }}>
                <SimpleTable
                  columns={[{ label: 'Técnico' }, { label: 'Concluídas', align: 'right' }]}
                  rows={r.operations.byTechnician.map((t) => [t.name, t.count])}
                  empty="Nenhuma OS concluída no mês."
                />
              </Box>
            </SectionCard>
          </Grid>

          <Grid item xs={12} lg={6}>
            <SectionCard title="Clientes" icon={<GroupsIcon color="primary" />}>
              <Metrics
                items={[
                  { label: 'Ativos', value: formatNumber(r.clients.active) },
                  { label: 'Novos no mês', value: formatNumber(r.clients.newInMonth) },
                  { label: 'Com OS no mês', value: formatNumber(r.clients.withOrders) },
                  { label: 'Inadimplentes', value: formatNumber(r.clients.delinquent), color: r.clients.delinquent ? 'error.main' : undefined },
                ]}
              />
              <SimpleTable
                columns={[{ label: 'Maiores inadimplências' }, { label: 'Cobranças', align: 'right' }, { label: 'Mais antiga', align: 'right' }, { label: 'Em atraso', align: 'right' }]}
                rows={r.clients.topDelinquents.map((d) => [d.clientName, d.count, formatDate(d.oldestDueDate), formatCurrency(d.total)])}
                empty="Nenhum cliente inadimplente."
              />
            </SectionCard>
          </Grid>

          <Grid item xs={12} lg={6}>
            <SectionCard title="Equipamentos" icon={<RouterIcon color="primary" />}>
              <Metrics
                items={[
                  { label: 'Disponíveis', value: formatNumber(r.equipment.available) },
                  { label: 'Instalados', value: formatNumber(r.equipment.installed), hint: `${r.equipment.installedInMonth} instalação(ões) no mês` },
                  { label: 'Em manutenção', value: formatNumber(r.equipment.maintenance) },
                  { label: 'Danificados', value: formatNumber(r.equipment.damaged), color: r.equipment.damaged ? 'error.main' : undefined },
                ]}
              />
              <SimpleTable
                columns={[{ label: 'Tipo' }, { label: 'Disponíveis', align: 'right' }, { label: 'Mínimo', align: 'right' }]}
                rows={r.equipment.stockByType.map((t) => [
                  <Typography key="n" variant="body2" color={t.belowMinimum ? 'error.main' : undefined} fontWeight={t.belowMinimum ? 700 : 400}>
                    {t.name}
                    {t.belowMinimum ? ' (abaixo do mínimo)' : ''}
                  </Typography>,
                  t.inStock,
                  t.minimumStock || '—',
                ])}
                empty="Nenhum tipo cadastrado."
              />
            </SectionCard>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              Critérios: previsto = cobranças não canceladas com vencimento no mês; recebido = pagamentos registrados no mês
              (horário de Brasília); atraso = vencida e não paga. Inclui cobranças de contratos e de ordens de serviço. O Excel traz
              também a lista completa de cobranças, OS do mês e inadimplentes.
            </Typography>
          </Grid>
        </Grid>
      )}
    </>
  );
}
