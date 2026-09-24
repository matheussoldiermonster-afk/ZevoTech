import { useNavigate } from 'react-router-dom';
import { Box, Chip, List, ListItemButton, ListItemText, Skeleton } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/NotificationsActiveOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SectionCard from '../../components/common/SectionCard';
import { ALERT_SEVERITY } from '../../constants/labels';
import { useAlerts } from './useDashboardData';

export default function AlertsCard() {
  const q = useAlerts();
  const navigate = useNavigate();
  const alerts = q.data || [];
  const pending = alerts.filter((a) => a.severity !== 'ok').length;

  return (
    <SectionCard
      title="Alertas"
      icon={<NotificationsIcon color="primary" />}
      action={pending > 0 ? <Chip size="small" color="error" label={pending} /> : null}
      loading={q.isLoading}
      error={q.isError && !q.data ? q.error : null}
      onRetry={q.refetch}
      skeleton={
        <Box>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={56} />
          ))}
        </Box>
      }
      contentSx={{ overflowY: 'auto', maxHeight: 420 }}
    >
      <List disablePadding>
        {alerts.map((a) => {
          const cfg = ALERT_SEVERITY[a.severity] || ALERT_SEVERITY.info;
          return (
            <ListItemButton
              key={a.id}
              disabled={!a.link}
              onClick={() => a.link && navigate(a.link)}
              sx={{
                borderRadius: 2,
                mb: 0.75,
                alignItems: 'flex-start',
                borderLeft: 4,
                borderColor: `${cfg.color}.main`,
                bgcolor: 'action.hover',
                '&.Mui-disabled': { opacity: 1 },
              }}
            >
              <Box component="span" aria-label={cfg.label} sx={{ mr: 1.25, mt: 0.25, fontSize: 14 }}>
                {cfg.emoji}
              </Box>
              <ListItemText
                primary={a.title}
                secondary={a.description}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              {a.link && <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary', mt: 0.5 }} />}
            </ListItemButton>
          );
        })}
      </List>
    </SectionCard>
  );
}
