import { Box, Typography } from '@mui/material';

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2,
        mb: 3,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</Box>}
    </Box>
  );
}
