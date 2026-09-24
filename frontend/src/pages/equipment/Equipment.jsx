import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Box, Button, Checkbox, Chip, FormControlLabel, InputAdornment, ListItemText, MenuItem, Switch, Tab, Tabs, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterOffIcon from '@mui/icons-material/FilterAltOffOutlined';
import api from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import ServerDataGrid from '../../components/common/ServerDataGrid';
import StatusChip from '../../components/common/StatusChip';
import useServerTable from '../../hooks/useServerTable';
import { useAuth } from '../../contexts/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import { EQUIPMENT_STATUS } from '../../constants/labels';
import { formatDate } from '../../utils/format';
import { formatAddress } from '../../utils/address';
import useEquipmentTypes from './useEquipmentTypes';
import EquipmentDrawer from './EquipmentDrawer';
import EquipmentFormDialog from './EquipmentFormDialog';
import StockByType from './StockByType';

const UUID_RE = /^[0-9a-f-]{36}$/i;
// Descartados só aparecem se o filtro pedir
const VISIBLE_STATUS = ['IN_STOCK', 'INSTALLED', 'MAINTENANCE', 'DAMAGED', 'DISCARDED'];

export default function Equipment() {
  const { isAdmin } = useAuth();
  const [urlParams, setUrlParams] = useSearchParams();
  const table = useServerTable({ sort: 'createdAt', order: 'desc' });
  const types = useEquipmentTypes();
  const [creating, setCreating] = useState(false);

  const belowMinimum = urlParams.get('belowMinimum') === 'true';
  const tab = urlParams.get('aba') === 'estoque' || belowMinimum ? 1 : 0;
  const status = (urlParams.get('status') || '').split(',').filter((s) => VISIBLE_STATUS.includes(s));
  const typeId = UUID_RE.test(urlParams.get('tipo') || '') ? urlParams.get('tipo') : '';
  const openId = UUID_RE.test(urlParams.get('eq') || '') ? urlParams.get('eq') : null;

  const update = (patch, { history = false } = {}) => {
    const next = new URLSearchParams(urlParams);
    Object.entries(patch).forEach(([k, v]) => {
      const value = Array.isArray(v) ? v.join(',') : v;
      if (value === null || value === undefined || value === '') next.delete(k);
      else next.set(k, value);
    });
    setUrlParams(next, { replace: !history });
    table.resetPage();
  };

  const params = useMemo(
    () => ({ ...table.params, status: status.join(',') || undefined, equipmentTypeId: typeId || undefined }),
    [table.params, urlParams] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const query = useQuery({
    queryKey: queryKeys.equipments.list(params),
    queryFn: () => api.get('/equipments', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: tab === 0,
  });

  const columns = [
    {
      field: 'type',
      headerName: 'Equipamento',
      flex: 1,
      minWidth: 180,
      renderCell: ({ row }) => (
        <Box sx={{ py: 1, lineHeight: 1.3, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {row.equipmentType?.name}
          </Typography>
          {(row.equipmentType?.model || row.serialNumber) && (
            <Typography variant="caption" color="text.secondary">
              {[row.equipmentType?.model, row.serialNumber && `nº ${row.serialNumber}`].filter(Boolean).join(' · ')}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'quantity',
      headerName: 'Quantidade',
      width: 130,
      type: 'number',
      renderCell: ({ row }) =>
        row.status === 'IN_STOCK' && row.quantity === 0 ? (
          <Chip size="small" color="error" variant="outlined" label="Esgotado" />
        ) : (
          <Typography variant="body1" fontWeight={700}>
            {row.quantity}
            <Typography component="span" variant="caption" color="text.secondary">
              {row.status === 'IN_STOCK' ? ' disponíveis' : ' un.'}
            </Typography>
          </Typography>
        ),
    },
    { field: 'status', headerName: 'Situação', width: 140, renderCell: ({ value }) => <StatusChip map={EQUIPMENT_STATUS} value={value} /> },
    {
      field: 'client',
      headerName: 'Local',
      flex: 1.5,
      minWidth: 240,
      renderCell: ({ row }) =>
        row.address ? (
          <Box sx={{ py: 1, lineHeight: 1.3, minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {row.client?.name}
              {row.address.company?.name && row.address.company.name !== row.client?.name ? ` — ${row.address.company.name}` : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {formatAddress(row.address, { withLabel: true })}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {row.status === 'IN_STOCK' ? 'Estoque' : '—'}
          </Typography>
        ),
    },
    { field: 'installationDate', headerName: 'Instalado em', width: 125, sortable: false, valueFormatter: (v) => (v ? formatDate(v) : '—') },
  ];

  const hasFilters = status.length || typeId;

  return (
    <>
      <PageHeader
        title="Equipamentos"
        actions={
          isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              Novo equipamento
            </Button>
          )
        }
      />
      <Tabs value={tab} onChange={(e, v) => update({ aba: v === 1 ? 'estoque' : null, belowMinimum: null })} sx={{ mb: 2 }}>
        <Tab label="Equipamentos" />
        <Tab label="Estoque por tipo" />
      </Tabs>

      {tab === 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Buscar equipamento, nº de série, cliente ou endereço"
              value={table.search}
              onChange={(e) => table.setSearch(e.target.value)}
              sx={{ flex: '1 1 260px', maxWidth: 420 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <TextField
              select
              size="small"
              label="Situação"
              sx={{ width: 200 }}
              InputLabelProps={{ shrink: true }}
              SelectProps={{
                multiple: true,
                displayEmpty: true,
                value: status,
                onChange: (e) => update({ status: e.target.value }),
                renderValue: (sel) => (sel.length === 0 ? 'Todas (exceto descartados)' : sel.map((s) => EQUIPMENT_STATUS[s].label).join(', ')),
              }}
            >
              {VISIBLE_STATUS.map((s) => (
                <MenuItem key={s} value={s}>
                  <Checkbox size="small" checked={status.includes(s)} />
                  <ListItemText primary={EQUIPMENT_STATUS[s].label} />
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Tipo" sx={{ width: 200 }} value={types.data?.some((t) => t.id === typeId) ? typeId : ''} onChange={(e) => update({ tipo: e.target.value })}>
              <MenuItem value="">Todos</MenuItem>
              {(types.data || []).map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
            {hasFilters ? (
              <Button size="small" startIcon={<FilterOffIcon />} onClick={() => update({ status: null, tipo: null })}>
                Limpar filtros
              </Button>
            ) : null}
          </Box>
          <ServerDataGrid
            query={query}
            columns={columns}
            getRowHeight={() => 'auto'}
            onRowClick={({ row }) => update({ eq: row.id }, { history: true })}
            sx={{ border: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            {...table.gridProps}
          />
          {query.data && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {query.data.total} registro(s) · cada registro mostra a quantidade de unidades daquele equipamento no local
            </Typography>
          )}
        </>
      )}

      {tab === 1 && (
        <>
          <FormControlLabel
            sx={{ mb: 1 }}
            control={<Switch checked={belowMinimum} onChange={(e) => update({ belowMinimum: e.target.checked ? 'true' : null, aba: 'estoque' })} />}
            label="Somente abaixo do mínimo"
          />
          <StockByType onlyBelowMinimum={belowMinimum} onOpenType={(id) => update({ aba: null, belowMinimum: null, tipo: id, status: null })} />
        </>
      )}

      <EquipmentDrawer id={openId} onClose={() => update({ eq: null })} />
      <EquipmentFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(eq) => update({ eq: eq.id }, { history: true })} />
    </>
  );
}
