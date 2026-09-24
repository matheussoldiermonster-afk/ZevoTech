import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import EmptyState from '../../components/common/EmptyState';
import EventIcon from '@mui/icons-material/EventOutlined';
import EventCard from './EventCard';
import {
  WEEKDAY_HEADERS,
  addDaysISO,
  monthGridDays,
  parseISODate,
  rangeForView,
  scheduleSortKey,
  weekdayShort,
} from '../../utils/calendar';

/** Agrupa agendamentos por dia ("AAAA-MM-DD") já ordenados por horário. */
export function groupByDay(schedules) {
  const map = new Map();
  for (const s of schedules) {
    const day = s.date.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(s);
  }
  for (const list of map.values()) list.sort((a, b) => scheduleSortKey(a).localeCompare(scheduleSortKey(b)));
  return map;
}

const PERIOD_GROUPS = [
  { key: 'MORNING', label: 'Manhã', test: (k) => k < '12:00' },
  { key: 'AFTERNOON', label: 'Tarde', test: (k) => k >= '12:00' && k < '18:00' },
  { key: 'EVENING', label: 'Noite', test: (k) => k >= '18:00' && k < '99:99' },
  { key: 'NONE', label: 'Sem horário', test: (k) => k === '99:99' },
];

export function DayView({ date, byDay, onOpen }) {
  const list = byDay.get(date) || [];
  if (list.length === 0) {
    return <EmptyState title="Nenhum atendimento neste dia" icon={<EventIcon sx={{ fontSize: 40, opacity: 0.5 }} />} />;
  }
  return (
    <Stack spacing={3}>
      {PERIOD_GROUPS.map((g) => {
        const items = list.filter((s) => g.test(scheduleSortKey(s)));
        if (!items.length) return null;
        return (
          <Box key={g.key}>
            <Typography variant="overline" color="text.secondary" fontWeight={700}>
              {g.label} ({items.length})
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' }, mt: 0.5 }}>
              {items.map((s) => (
                <EventCard key={s.id} schedule={s} onClick={onOpen} />
              ))}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

export function WeekView({ date, today, byDay, onOpen, onPickDay }) {
  const { from } = rangeForView('week', date);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(from, i));
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(7, minmax(0, 1fr))' },
      }}
    >
      {days.map((d) => {
        const list = byDay.get(d) || [];
        const isToday = d === today;
        return (
          <Box key={d} sx={{ minWidth: 0 }}>
            <ButtonBase
              onClick={() => onPickDay(d)}
              sx={{
                width: '100%',
                justifyContent: 'space-between',
                px: 1,
                py: 0.75,
                mb: 1,
                borderRadius: 2,
                bgcolor: isToday ? 'primary.main' : 'action.hover',
                color: isToday ? 'primary.contrastText' : 'text.primary',
              }}
            >
              <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
                {weekdayShort(d)} {parseISODate(d).getUTCDate()}
              </Typography>
              <Typography variant="caption">{list.length || ''}</Typography>
            </ButtonBase>
            <Stack spacing={1}>
              {list.length === 0 ? (
                <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
                  —
                </Typography>
              ) : (
                list.map((s) => <EventCard key={s.id} schedule={s} onClick={onOpen} />)
              )}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

const MAX_PER_CELL = 3;

export function MonthView({ date, today, byDay, onOpen, onPickDay }) {
  const days = monthGridDays(date);
  const month = date.slice(0, 7);
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ minWidth: 700 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {WEEKDAY_HEADERS.map((w) => (
            <Typography key={w} variant="caption" fontWeight={700} color="text.secondary" align="center" sx={{ textTransform: 'uppercase' }}>
              {w}
            </Typography>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: 1, borderLeft: 1, borderColor: 'divider' }}>
          {days.map((d) => {
            const list = byDay.get(d) || [];
            const outside = d.slice(0, 7) !== month;
            const isToday = d === today;
            return (
              <Box
                key={d}
                onClick={() => onPickDay(d)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' ? onPickDay(d) : null)}
                aria-label={`${parseISODate(d).getUTCDate()}: ${list.length} atendimento(s)`}
                sx={{
                  minHeight: 108,
                  p: 0.5,
                  borderRight: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                  cursor: 'pointer',
                  bgcolor: outside ? 'action.hover' : 'transparent',
                  '&:hover': { bgcolor: 'action.selected' },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.25,
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    alignSelf: 'flex-end',
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 500,
                    bgcolor: isToday ? 'primary.main' : 'transparent',
                    color: isToday ? 'primary.contrastText' : outside ? 'text.disabled' : 'text.primary',
                  }}
                >
                  {parseISODate(d).getUTCDate()}
                </Box>
                {list.slice(0, MAX_PER_CELL).map((s) => (
                  <EventCard key={s.id} schedule={s} onClick={onOpen} compact />
                ))}
                {list.length > MAX_PER_CELL && (
                  <Typography variant="caption" color="primary" fontWeight={700} sx={{ px: 0.5 }}>
                    +{list.length - MAX_PER_CELL} mais
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
