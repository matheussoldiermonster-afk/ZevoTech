import { Box, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/InboxOutlined';

export default function EmptyState({ icon, title = 'Nada por aqui', description, action, compact = false }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 0.75,
        py: compact ? 2 : 4,
        px: 2,
        color: 'text.secondary',
      }}
    >
      {icon || <InboxIcon sx={{ fontSize: compact ? 28 : 40, opacity: 0.5 }} />}
      <Typography variant="body2" fontWeight={600} color="text.primary">
        {title}
      </Typography>
      {description && <Typography variant="caption">{description}</Typography>}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  );
}
