import { Box, Skeleton } from '@mui/material';

/** Carregamento de uma tela enquanto o código dela é baixado (rotas sob demanda). */
export default function PageSkeleton() {
  return (
    <Box aria-busy="true" aria-label="Carregando">
      <Skeleton height={44} width={280} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={56} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={420} />
    </Box>
  );
}
