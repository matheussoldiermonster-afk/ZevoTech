import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackOutlined';
import { useNavigate } from 'react-router-dom';

export default function PageHeader({ title, subtitle, action, onBack, icon: Icon }) {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {onBack && (
          <Tooltip title="Voltar">
            <IconButton onClick={() => (typeof onBack === 'function' ? onBack() : navigate(-1))} sx={{ mt: 0.5 }}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
        )}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {Icon && <Icon color="primary" />}
            <Typography variant="h5" fontWeight={700}>
              {title}
            </Typography>
          </Box>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {action && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{action}</Box>}
    </Box>
  );
}
