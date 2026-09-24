import { Card, CardContent, Box, Typography, Avatar } from '@mui/material';

/**
 * Bloco visual padrão para agrupar informações em seções — usado no
 * Dashboard, no perfil do Cliente e na visão de Empresa, para evitar
 * a sensação de "informações jogadas na tela".
 */
export default function SectionCard({ icon: Icon, title, subtitle, action, children, dense = false }) {
  return (
    <Card elevation={0} sx={{ height: '100%' }}>
      <CardContent sx={{ p: dense ? 2 : 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {(title || action) && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              {Icon && (
                <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', width: 34, height: 34, borderRadius: 2 }}>
                  <Icon fontSize="small" />
                </Avatar>
              )}
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {title}
                </Typography>
                {subtitle && (
                  <Typography variant="caption" color="text.secondary">
                    {subtitle}
                  </Typography>
                )}
              </Box>
            </Box>
            {action}
          </Box>
        )}
        <Box sx={{ flexGrow: 1 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}
