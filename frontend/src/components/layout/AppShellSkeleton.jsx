import { Box, Grid, Skeleton } from '@mui/material';

/** Tela de carregamento no formato do layout (substitui o spinner de tela cheia). */
export default function AppShellSkeleton() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }} aria-busy="true" aria-label="Carregando">
      <Box sx={{ width: 248, display: { xs: 'none', md: 'block' }, borderRight: 1, borderColor: 'divider', p: 2 }}>
        <Skeleton height={48} sx={{ mb: 2 }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={40} />
        ))}
      </Box>
      <Box sx={{ flex: 1, p: 3 }}>
        <Skeleton height={40} width={260} sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} sm={6} lg={3} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
          <Grid item xs={12}>
            <Skeleton variant="rounded" height={320} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
