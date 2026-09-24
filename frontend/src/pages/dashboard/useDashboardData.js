import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { DASHBOARD_QUERY_OPTIONS } from '../../lib/queryClient';
import { todayISO } from '../../utils/format';

const get = (url, params) => api.get(url, { params }).then((r) => r.data);

// Todos os blocos usam cache de 60 s e polling de 2 min apenas com a aba visível.
const base = { ...DASHBOARD_QUERY_OPTIONS, placeholderData: keepPreviousData };

export const useKpis = (month) =>
  useQuery({ queryKey: queryKeys.dashboard.kpis(month), queryFn: () => get('/dashboard/kpis', { month }), ...base });

export const useOperations = (month) =>
  useQuery({
    queryKey: queryKeys.dashboard.operations(month),
    queryFn: () => get('/dashboard/operations', { month }),
    ...base,
  });

export const useFinanceSummary = (month) =>
  useQuery({ queryKey: queryKeys.finance.summary(month), queryFn: () => get('/finance/summary', { month }), ...base });

export const useRevenueSeries = (from, to, enabled = true) =>
  useQuery({
    queryKey: queryKeys.finance.series(from, to),
    queryFn: () => get('/finance/series', { from, to }),
    enabled,
    ...base,
  });

export const useEquipmentOverview = () =>
  useQuery({ queryKey: queryKeys.dashboard.equipment(), queryFn: () => get('/dashboard/equipment'), ...base });

export const useAlerts = () => useQuery({ queryKey: queryKeys.alerts, queryFn: () => get('/alerts'), ...base });

/** Agenda de hoje: reutiliza /api/schedules. */
export function useTodaySchedules() {
  const date = todayISO();
  return useQuery({
    queryKey: queryKeys.schedules.range({ date }),
    queryFn: () => get('/schedules', { date }),
    ...base,
  });
}
