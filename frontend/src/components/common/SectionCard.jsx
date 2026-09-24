import { Box, Paper, Skeleton, Typography } from '@mui/material';
import ErrorState from './ErrorState';

/**
 * Bloco padrão das telas: título, ação opcional e três estados
 * (carregando com skeleton, erro com "tentar novamente", conteúdo).
 */
export default function SectionCard({
  title,
  subtitle,
  icon,
  action,
  loading = false,
  error = null,
  onRetry,
  skeleton,
  children,
  sx,
  contentSx,
}) {
  let body = children;
  if (loading) {
    body = skeleton || (
      <Box>
        <Skeleton height={28} />
        <Skeleton height={28} />
        <Skeleton height={28} width="70%" />
      </Box>
    );
  } else if (error) {
    body = <ErrorState error={error} onRetry={onRetry} />;
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: { xs: 2, sm: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column', ...sx }}
    >
      {(title || action) && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {icon}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary" component="div">
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, ...contentSx }}>{body}</Box>
    </Paper>
  );
}
