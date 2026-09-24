import { Box, Button, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloudOffIcon from '@mui/icons-material/CloudOffOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getErrorMessage } from '../../services/api';

/** Estado de erro com botão "Tentar novamente". */
export default function ErrorState({ error, message, onRetry, compact = false }) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const text = message || getErrorMessage(error);
  const Icon = offline ? CloudOffIcon : ErrorOutlineIcon;

  return (
    <Box
      role="alert"
      sx={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: compact ? 'left' : 'center',
        gap: compact ? 1.5 : 1,
        py: compact ? 1.5 : 4,
        px: 2,
        color: 'text.secondary',
      }}
    >
      <Icon color="error" sx={{ fontSize: compact ? 24 : 36 }} />
      <Typography variant="body2" sx={{ flex: compact ? 1 : 'unset' }}>
        {text}
      </Typography>
      {onRetry && (
        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => onRetry()}>
          Tentar novamente
        </Button>
      )}
    </Box>
  );
}
