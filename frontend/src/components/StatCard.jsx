import { Card, CardContent, Box, Typography, Avatar } from '@mui/material';

const toneStyles = {
  primary: { bg: 'rgba(15,107,114,0.10)', fg: '#0F6B72' },
  success: { bg: 'rgba(46,125,79,0.10)', fg: '#2E7D4F' },
  warning: { bg: 'rgba(181,117,11,0.12)', fg: '#B5750B' },
  error: { bg: 'rgba(193,59,59,0.10)', fg: '#C13B3B' },
  info: { bg: 'rgba(46,111,167,0.10)', fg: '#2E6FA7' },
  neutral: { bg: 'rgba(91,107,109,0.10)', fg: '#5B6B6D' },
};

/**
 * Cartão de indicador para o Dashboard e demais telas de resumo.
 * Pensado para parecer um "KPI card" de sistema de gestão, não uma
 * célula de planilha: ícone + rótulo + valor grande + nota de apoio.
 */
export default function StatCard({ icon: Icon, label, value, helperText, tone = 'primary', footer }) {
  const style = toneStyles[tone] || toneStyles.primary;

  return (
    <Card elevation={0} sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {Icon && (
            <Avatar
              variant="rounded"
              sx={{ bgcolor: style.bg, color: style.fg, width: 40, height: 40, borderRadius: 2.5 }}
            >
              <Icon fontSize="small" />
            </Avatar>
          )}
          <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: 0.4 }}>
            {label}
          </Typography>
        </Box>

        <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.1 }}>
          {value}
        </Typography>

        {helperText && (
          <Typography variant="body2" color="text.secondary">
            {helperText}
          </Typography>
        )}

        {footer && <Box sx={{ mt: 'auto', pt: 0.5 }}>{footer}</Box>}
      </CardContent>
    </Card>
  );
}
