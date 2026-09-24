import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Grid, List, ListItem, ListItemText, Skeleton, Typography } from '@mui/material';
import RouterIcon from '@mui/icons-material/RouterOutlined';
import WarningIcon from '@mui/icons-material/WarningAmberOutlined';
import SectionCard from '../../components/common/SectionCard';
import { formatNumber } from '../../utils/format';
import { useEquipmentOverview } from './useDashboardData';

function Tile({ label, value, color, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      focusRipple
      sx={{ width: '100%', display: 'block', textAlign: 'left', p: 1.25, borderRadius: 2, border: 1, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}
    >
      <Typography variant="h6" fontWeight={700} color={color}>
        {formatNumber(value)}
      </Typography>
      <Typography variant="caption" fontWeight={600}>
        {label}
      </Typography>
    </ButtonBase>
  );
}

export default function EquipmentCard() {
  const q = useEquipmentOverview();
  const navigate = useNavigate();
  const d = q.data;
  const go = (status) => navigate(`/equipamentos?status=${status}`);

  return (
    <SectionCard
      title="Equipamentos"
      icon={<RouterIcon color="primary" />}
      loading={q.isLoading}
      error={q.isError && !d ? q.error : null}
      onRetry={q.refetch}
      skeleton={
        <Grid container spacing={1.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={6} key={i}>
              <Skeleton variant="rounded" height={64} />
            </Grid>
          ))}
        </Grid>
      }
    >
      {d && (
        <>
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <Tile label="Disponíveis" value={d.available} color="info.main" onClick={() => go('IN_STOCK')} />
            </Grid>
            <Grid item xs={6}>
              <Tile label="Instalados" value={d.installed} color="success.main" onClick={() => go('INSTALLED')} />
            </Grid>
            <Grid item xs={6}>
              <Tile label="Em manutenção" value={d.maintenance} color="warning.main" onClick={() => go('MAINTENANCE')} />
            </Grid>
            <Grid item xs={6}>
              <Tile label="Danificados" value={d.damaged} color="error.main" onClick={() => go('DAMAGED')} />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {d.belowMinimum.length > 0 && <WarningIcon fontSize="small" color="warning" />}
              Abaixo do estoque mínimo ({d.belowMinimum.length})
            </Typography>
            {d.belowMinimum.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                Todos os itens estão acima do mínimo.
              </Typography>
            ) : (
              <List dense disablePadding>
                {d.belowMinimum.map((t) => (
                  <ListItem key={t.id} disableGutters secondaryAction={
                    <Typography variant="caption" fontWeight={700} color="error.main">
                      {t.inStock} / {t.minimumStock}
                    </Typography>
                  }>
                    <ListItemText primary={t.name} primaryTypographyProps={{ variant: 'body2' }} />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </>
      )}
    </SectionCard>
  );
}
