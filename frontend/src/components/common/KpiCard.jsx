import { Box, ButtonBase, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { formatPercent } from '../../utils/format';
import ErrorState from './ErrorState';

/**
 * Card de indicador.
 *  - change: variação % em relação ao período anterior (null = sem base de comparação)
 *  - invertTrend: true quando aumentar é ruim (ex.: "Em aberto")
 */
export default function KpiCard({
  title,
  value,
  icon,
  change,
  changeLabel = 'vs. mês anterior',
  invertTrend = false,
  footer,
  loading = false,
  error,
  onRetry,
  onClick,
  accent = 'primary.main',
}) {
  const hasChange = change !== undefined;
  let trendColor = 'text.secondary';
  let TrendIcon = TrendingFlatIcon;
  if (typeof change === 'number' && change !== 0) {
    const good = invertTrend ? change < 0 : change > 0;
    trendColor = good ? 'success.main' : 'error.main';
    TrendIcon = change > 0 ? TrendingUpIcon : TrendingDownIcon;
  }

  const content = (
    <Box sx={{ p: { xs: 2, sm: 2.5 }, width: '100%', textAlign: 'left' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {title}
        </Typography>
        {icon && (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: accent,
              bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,107,114,0.08)'),
            }}
          >
            {icon}
          </Box>
        )}
      </Box>

      {loading ? (
        <>
          <Skeleton variant="text" height={40} width="70%" />
          <Skeleton variant="text" width="50%" />
        </>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} compact />
      ) : (
        <>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2, wordBreak: 'break-word' }}>
            {value}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, minHeight: 22, flexWrap: 'wrap' }}>
            {hasChange && (
              <Tooltip title={change === null ? 'Sem valor no mês anterior para comparar' : ''}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: trendColor }}>
                  <TrendIcon sx={{ fontSize: 18 }} />
                  <Typography variant="caption" fontWeight={700}>
                    {change === null ? 'novo' : formatPercent(change, { signed: true })}
                  </Typography>
                </Box>
              </Tooltip>
            )}
            {hasChange && (
              <Typography variant="caption" color="text.secondary">
                {changeLabel}
              </Typography>
            )}
            {footer && (
              <Typography variant="caption" color="text.secondary" component="div">
                {footer}
              </Typography>
            )}
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        transition: 'box-shadow .2s ease, transform .2s ease',
        ...(onClick && { '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' } }),
      }}
    >
      {onClick ? (
        <ButtonBase onClick={onClick} sx={{ width: '100%', alignItems: 'stretch' }} focusRipple>
          {content}
        </ButtonBase>
      ) : (
        content
      )}
    </Paper>
  );
}
