import { Box, Chip, List, ListItem, ListItemText, Skeleton, Typography } from '@mui/material';
import EventIcon from '@mui/icons-material/EventOutlined';
import SectionCard from '../../components/common/SectionCard';
import EmptyState from '../../components/common/EmptyState';
import StatusChip from '../../components/common/StatusChip';
import { PERIOD, PRIORITY, SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, labelOf } from '../../constants/labels';
import { formatDate, todayISO } from '../../utils/format';
import { useTodaySchedules } from './useDashboardData';

function addressLine(a) {
  if (!a) return '';
  const street = [a.street, a.number].filter(Boolean).join(', ');
  return [street || a.label, a.district, a.city].filter(Boolean).join(' · ');
}

export default function TodayAgendaCard() {
  const q = useTodaySchedules();
  const items = (q.data || []).filter((s) => s.serviceOrder?.status !== 'CANCELLED');

  return (
    <SectionCard
      title="Agenda de hoje"
      subtitle={formatDate(`${todayISO()}T00:00:00Z`)}
      icon={<EventIcon color="primary" />}
      action={items.length ? <Chip size="small" label={items.length} /> : null}
      loading={q.isLoading}
      error={q.isError && !q.data ? q.error : null}
      onRetry={q.refetch}
      skeleton={
        <Box>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={64} />
          ))}
        </Box>
      }
      contentSx={{ overflowY: 'auto', maxHeight: 420 }}
    >
      {items.length === 0 ? (
        <EmptyState compact title="Nenhum atendimento hoje" icon={<EventIcon sx={{ fontSize: 28, opacity: 0.5 }} />} />
      ) : (
        <List disablePadding>
          {items.map((s) => {
            const os = s.serviceOrder;
            const technician = s.technician?.name || os.technician?.name;
            return (
              <ListItem key={s.id} disableGutters divider alignItems="flex-start" sx={{ gap: 1.5 }}>
                <Box sx={{ minWidth: 56, pt: 0.5 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {s.time || labelOf(PERIOD, s.period) || '—'}
                  </Typography>
                  {os.priority === 'URGENT' || os.priority === 'HIGH' ? (
                    <StatusChip map={PRIORITY} value={os.priority} sx={{ mt: 0.5, height: 20, fontSize: 11 }} />
                  ) : null}
                </Box>
                <ListItemText
                  primary={`#${os.orderNumber} · ${os.client?.name}${os.company && os.company.name !== os.client?.name ? ` — ${os.company.name}` : ''}`}
                  secondary={
                    <>
                      {labelOf(SERVICE_ORDER_TYPE, os.type)}
                      {technician ? ` · ${technician}` : ' · sem técnico'}
                      {addressLine(os.address) && (
                        <Typography component="span" variant="caption" display="block" color="text.secondary">
                          {addressLine(os.address)}
                        </Typography>
                      )}
                    </>
                  }
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                  secondaryTypographyProps={{ variant: 'caption', component: 'div' }}
                />
                <StatusChip map={SERVICE_ORDER_STATUS} value={os.status} sx={{ mt: 0.5 }} />
              </ListItem>
            );
          })}
        </List>
      )}
    </SectionCard>
  );
}
