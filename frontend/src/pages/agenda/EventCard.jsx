import { Box, ButtonBase, Typography } from '@mui/material';
import { PERIOD, PRIORITY, SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, labelOf } from '../../constants/labels';
import { formatAddress } from '../../utils/address';

const STATUS_COLOR = {
  OPEN: 'info.main',
  IN_PROGRESS: 'warning.main',
  COMPLETED: 'success.main',
  CANCELLED: 'text.disabled',
};

export function scheduleTimeLabel(s) {
  return s.time || labelOf(PERIOD, s.period) || 'Sem horário';
}

/** Atendimento na agenda. `compact` para a visão de mês. */
export default function EventCard({ schedule: s, onClick, compact = false }) {
  const os = s.serviceOrder;
  const technician = s.technician?.name || os.technician?.name;
  const urgent = os.priority === 'URGENT' || os.priority === 'HIGH';
  const done = os.status === 'COMPLETED' || os.status === 'CANCELLED';

  if (compact) {
    return (
      <ButtonBase
        onClick={(e) => {
          e.stopPropagation();
          onClick(s);
        }}
        title={`#${os.orderNumber} ${os.title} — ${os.client?.name}`}
        sx={{
          width: '100%',
          justifyContent: 'flex-start',
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
          borderLeft: 3,
          borderColor: STATUS_COLOR[os.status],
          bgcolor: 'action.hover',
          fontSize: 12,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          opacity: done ? 0.6 : 1,
          textDecoration: os.status === 'CANCELLED' ? 'line-through' : 'none',
        }}
      >
        <Box component="span" sx={{ fontWeight: 700, mr: 0.5 }}>
          {s.time || ''}
        </Box>
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {os.client?.name}
        </Box>
      </ButtonBase>
    );
  }

  return (
    <ButtonBase
      onClick={() => onClick(s)}
      focusRipple
      sx={{
        width: '100%',
        display: 'block',
        textAlign: 'left',
        p: 1.25,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        borderLeft: 4,
        borderLeftColor: STATUS_COLOR[os.status],
        bgcolor: 'background.paper',
        opacity: done ? 0.7 : 1,
        transition: 'box-shadow .15s ease',
        '&:hover': { boxShadow: 2 },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="caption" fontWeight={700}>
          {scheduleTimeLabel(s)}
        </Typography>
        <Typography variant="caption" color={urgent ? 'error.main' : 'text.secondary'} fontWeight={urgent ? 700 : 400}>
          {urgent ? labelOf(PRIORITY, os.priority) : labelOf(SERVICE_ORDER_STATUS, os.status)}
        </Typography>
      </Box>
      <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
        #{os.orderNumber} · {os.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div">
        {os.client?.name}
        {os.company && os.company.name !== os.client?.name ? ` — ${os.company.name}` : ''}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div" noWrap>
        {formatAddress(os.address)}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div">
        {labelOf(SERVICE_ORDER_TYPE, os.type)} · {technician || 'sem técnico'}
      </Typography>
    </ButtonBase>
  );
}
