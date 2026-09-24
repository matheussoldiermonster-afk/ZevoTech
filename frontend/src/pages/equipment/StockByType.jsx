import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { Box, Button, Chip, IconButton, Paper, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import WarningIcon from '@mui/icons-material/WarningAmberOutlined';
import api from '../../services/api';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateGroup } from '../../lib/queryKeys';
import useEquipmentTypes from './useEquipmentTypes';
import EquipmentTypeDialog from './EquipmentTypeDialog';

/** Estoque por tipo: disponíveis, instalados, manutenção, danificados e mínimo. */
export default function StockByType({ onlyBelowMinimum, onOpenType }) {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const q = useEquipmentTypes();
  const [dialog, setDialog] = useState(null); // { type? }

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/equipment-types/${id}`),
    onSuccess: () => {
      invalidateGroup(queryClient, 'equipment');
      enqueueSnackbar('Tipo desativado.', { variant: 'success' });
    },
  });

  async function handleRemove(t) {
    const ok = await confirm({
      title: `Desativar o tipo "${t.name}"?`,
      message: 'O tipo deixa de aparecer para novos equipamentos. Os equipamentos existentes não são alterados.',
      confirmText: 'Desativar',
      danger: true,
    });
    if (ok) remove.mutate(t.id);
  }

  const rows = (q.data || []).filter((t) => !onlyBelowMinimum || t.belowMinimum);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          {onlyBelowMinimum ? 'Mostrando apenas os tipos abaixo do estoque mínimo.' : 'Clique em um tipo para ver seus equipamentos.'}
        </Typography>
        {isAdmin && (
          <Button startIcon={<AddIcon />} onClick={() => setDialog({})}>
            Novo tipo
          </Button>
        )}
      </Box>
      {q.isLoading ? (
        <Skeleton variant="rounded" height={240} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState title={onlyBelowMinimum ? 'Nenhum tipo abaixo do mínimo' : 'Nenhum tipo cadastrado'} />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell align="right">Disponíveis</TableCell>
                <TableCell align="right">Mínimo</TableCell>
                <TableCell align="right">Instalados</TableCell>
                <TableCell align="right">Manutenção</TableCell>
                <TableCell align="right">Danificados</TableCell>
                {isAdmin && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpenType(t.id)}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {t.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.category}
                      {t.model ? ` · ${t.model}` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {t.belowMinimum ? (
                      <Chip size="small" color="error" icon={<WarningIcon />} label={t.counts.inStock} />
                    ) : (
                      t.counts.inStock
                    )}
                  </TableCell>
                  <TableCell align="right">{t.minimumStock || '—'}</TableCell>
                  <TableCell align="right">{t.counts.installed}</TableCell>
                  <TableCell align="right">{t.counts.maintenance}</TableCell>
                  <TableCell align="right">{t.counts.damaged}</TableCell>
                  {isAdmin && (
                    <TableCell align="right" onClick={(e) => e.stopPropagation()} sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Editar tipo">
                        <IconButton size="small" onClick={() => setDialog({ type: t })} aria-label={`Editar ${t.name}`}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Desativar tipo">
                        <IconButton size="small" onClick={() => handleRemove(t)} aria-label={`Desativar ${t.name}`}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <EquipmentTypeDialog open={Boolean(dialog)} type={dialog?.type} onClose={() => setDialog(null)} />
    </>
  );
}
