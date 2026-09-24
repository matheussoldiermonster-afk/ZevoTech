import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  LinearProgress,
  ListItemText,
  MenuItem,
  Paper,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import EngineeringIcon from '@mui/icons-material/EngineeringOutlined';
import FilterOffIcon from '@mui/icons-material/FilterAltOffOutlined';
import api from '../../services/api';
import ErrorState from '../../components/common/ErrorState';
import ClientPicker from '../../components/forms/ClientPicker';
import { useAuth } from '../../contexts/AuthContext';
import { useCompaniesOfClient, useTechnicians } from '../../lib/lookups';
import { queryKeys } from '../../lib/queryKeys';
import { PRIORITY, SERVICE_ORDER_STATUS } from '../../constants/labels';
import { todayISO } from '../../utils/format';
import { rangeForView, shiftView, viewTitle } from '../../utils/calendar';
import ServiceOrderDrawer from '../service-orders/ServiceOrderDrawer';
import ServiceOrderFormDialog from '../service-orders/ServiceOrderFormDialog';
import TechniciansDialog from './TechniciansDialog';
import { DayView, MonthView, WeekView, groupByDay } from './AgendaViews';

const VIEWS = { dia: 'day', semana: 'week', mes: 'month' };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
// Por padrão a agenda esconde as OS canceladas
const DEFAULT_STATUS = ['OPEN', 'IN_PROGRESS', 'COMPLETED'];

function listParam(value, allowed, fallback = []) {
  if (value === null) return fallback;
  return value.split(',').filter((v) => allowed.includes(v));
}

function MultiFilter({ label, value, options, onChange, width = 180 }) {
  return (
    <TextField
      select
      size="small"
      label={label}
      sx={{ width }}
      SelectProps={{
        multiple: true,
        value,
        displayEmpty: true,
        onChange: (e) => onChange(e.target.value),
        renderValue: (sel) => (sel.length === 0 ? 'Todos' : sel.length === 1 ? options[sel[0]].label : `${sel.length} selecionados`),
      }}
      InputLabelProps={{ shrink: true }}
    >
      {Object.entries(options).map(([k, v]) => (
        <MenuItem key={k} value={k}>
          <Checkbox size="small" checked={value.includes(k)} />
          <ListItemText primary={v.label} />
        </MenuItem>
      ))}
    </TextField>
  );
}

export default function Agenda() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const [openOrderId, setOpenOrderId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [techOpen, setTechOpen] = useState(false);

  const viewKey = Object.keys(VIEWS).includes(params.get('visao')) ? params.get('visao') : 'semana';
  const view = VIEWS[viewKey];
  const date = DATE_RE.test(params.get('data') || '') ? params.get('data') : today;
  const status = listParam(params.get('status'), Object.keys(SERVICE_ORDER_STATUS), DEFAULT_STATUS);
  const priority = listParam(params.get('prioridade'), Object.keys(PRIORITY));
  const technicianId = UUID_RE.test(params.get('tecnico') || '') ? params.get('tecnico') : '';
  const clientId = UUID_RE.test(params.get('cliente') || '') ? params.get('cliente') : '';
  const clientName = params.get('clienteNome') || '';
  const companyId = UUID_RE.test(params.get('empresa') || '') ? params.get('empresa') : '';

  const technicians = useTechnicians();
  const companies = useCompaniesOfClient(clientId);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      const value = Array.isArray(v) ? v.join(',') : v;
      if (value === undefined || value === null || value === '') next.delete(k);
      else next.set(k, value);
    });
    setParams(next, { replace: true });
  };

  const range = rangeForView(view, date);
  const apiParams = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      status: status.join(',') || undefined,
      priority: priority.join(',') || undefined,
      technicianId: technicianId || undefined,
      clientId: clientId || undefined,
      companyId: companyId || undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range.from, range.to, params]
  );

  const q = useQuery({
    queryKey: queryKeys.schedules.range(apiParams),
    queryFn: () => api.get('/schedules', { params: apiParams }).then((r) => r.data),
    placeholderData: keepPreviousData,
    refetchInterval: 2 * 60 * 1000,
  });
  const byDay = useMemo(() => groupByDay(q.data || []), [q.data]);

  const hasFilters =
    params.has('status') || priority.length || technicianId || clientId || companyId;
  const clearFilters = () =>
    update({ status: null, prioridade: null, tecnico: null, cliente: null, clienteNome: null, empresa: null });

  const goToDay = (d) => update({ data: d, visao: 'dia' });
  const statusValue = status;

  return (
    <>
      {/* Cabeçalho: navegação e visões */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Button variant="outlined" onClick={() => update({ data: null })} disabled={date === today}>
          Hoje
        </Button>
        <Tooltip title="Anterior">
          <IconButton onClick={() => update({ data: shiftView(view, date, -1) })} aria-label="Período anterior">
            <ChevronLeftIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Próximo">
          <IconButton onClick={() => update({ data: shiftView(view, date, 1) })} aria-label="Próximo período">
            <ChevronRightIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1, minWidth: 200 }}>
          {viewTitle(view, date)}
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={viewKey} onChange={(e, v) => v && update({ visao: v === 'semana' ? null : v })}>
          <ToggleButton value="dia">Dia</ToggleButton>
          <ToggleButton value="semana">Semana</ToggleButton>
          <ToggleButton value="mes">Mês</ToggleButton>
        </ToggleButtonGroup>
        {isAdmin && (
          <>
            <Tooltip title="Cadastro de técnicos">
              <Button startIcon={<EngineeringIcon />} onClick={() => setTechOpen(true)}>
                Técnicos
              </Button>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              Nova OS
            </Button>
          </>
        )}
      </Box>

      {/* Filtros */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, alignItems: 'flex-start' }}>
        <MultiFilter
          label="Status"
          value={statusValue}
          options={SERVICE_ORDER_STATUS}
          onChange={(v) => update({ status: v.length ? v : 'todos' })}
        />
        <MultiFilter label="Prioridade" value={priority} options={PRIORITY} onChange={(v) => update({ prioridade: v })} width={160} />
        <TextField
          select
          size="small"
          label="Técnico"
          sx={{ width: 180 }}
          value={technicians.data?.some((t) => t.id === technicianId) ? technicianId : ''}
          onChange={(e) => update({ tecnico: e.target.value })}
        >
          <MenuItem value="">Todos</MenuItem>
          {(technicians.data || []).map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ width: 240 }}>
          <ClientPicker
            label="Cliente"
            value={clientId ? { id: clientId, name: clientName } : null}
            onChange={(c) => update({ cliente: c?.id, clienteNome: c?.name, empresa: null })}
          />
        </Box>
        <TextField
          select
          size="small"
          label="Empresa"
          sx={{ width: 200 }}
          disabled={!clientId}
          value={companies.data?.some((c) => c.id === companyId) ? companyId : ''}
          onChange={(e) => update({ empresa: e.target.value })}
        >
          <MenuItem value="">Todas</MenuItem>
          {(companies.data || []).map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        {hasFilters ? (
          <Button size="small" startIcon={<FilterOffIcon />} onClick={clearFilters} sx={{ mt: 0.5 }}>
            Limpar filtros
          </Button>
        ) : null}
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, position: 'relative' }}>
        {q.isFetching && q.data && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        {q.isLoading ? (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(7, 1fr)' } }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={160} />
            ))}
          </Box>
        ) : q.isError && !q.data ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : view === 'day' ? (
          <DayView date={date} byDay={byDay} onOpen={(s) => setOpenOrderId(s.serviceOrderId)} />
        ) : view === 'week' ? (
          <WeekView date={date} today={today} byDay={byDay} onOpen={(s) => setOpenOrderId(s.serviceOrderId)} onPickDay={goToDay} />
        ) : (
          <MonthView date={date} today={today} byDay={byDay} onOpen={(s) => setOpenOrderId(s.serviceOrderId)} onPickDay={goToDay} />
        )}
      </Paper>
      {q.data && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {q.data.length} atendimento(s) no período
        </Typography>
      )}

      <ServiceOrderDrawer id={openOrderId} onClose={() => setOpenOrderId(null)} />
      <ServiceOrderFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        defaults={{ date: date >= today ? date : today }}
        onSaved={(os) => setOpenOrderId(os.id)}
      />
      <TechniciansDialog open={techOpen} onClose={() => setTechOpen(false)} />
    </>
  );
}
