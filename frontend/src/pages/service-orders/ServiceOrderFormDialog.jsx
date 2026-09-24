import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import api, { getErrorMessage } from '../../services/api';
import LocationFields from '../../components/forms/LocationFields';
import { useEquipmentOptions, useTechnicians } from '../../lib/lookups';
import { invalidateGroup } from '../../lib/queryKeys';
import { EQUIPMENT_STATUS, PERIOD, PRIORITY, SERVICE_ORDER_TYPE, labelOf } from '../../constants/labels';
import { formatCurrency } from '../../utils/format';

const emptyItem = { description: '', quantity: 1, unitValue: '' };

function initialState(order, defaults) {
  if (order) {
    return {
      location: {
        client: order.client ? { id: order.client.id, name: order.client.name } : null,
        companyId: order.companyId || '',
        addressId: order.addressId || '',
      },
      title: order.title || '',
      type: order.type,
      priority: order.priority || 'NORMAL',
      technicianId: order.technicianId || '',
      description: order.description || '',
      dueDate: order.dueDate ? order.dueDate.slice(0, 10) : '',
      // [{ equipmentId, quantity }]
      equipments: (order.equipments || []).map((l) => ({ equipmentId: l.equipment.id, quantity: String(l.quantity ?? 1) })),
      items: (order.items || []).map((i) => ({ description: i.description, quantity: i.quantity, unitValue: String(i.unitValue) })),
      schedule: { date: '', time: '', period: '' },
    };
  }
  return {
    location: { client: defaults?.client || null, companyId: '', addressId: '' },
    title: '',
    type: 'CORRECTIVE',
    priority: 'NORMAL',
    technicianId: '',
    description: '',
    dueDate: '',
    equipments: [],
    items: [],
    schedule: { date: defaults?.date || '', time: '', period: '' },
  };
}

function validate(form, isEdit) {
  const e = {};
  if (!form.location.client) e.client = 'Selecione o cliente.';
  if (!form.location.companyId) e.companyId = 'Selecione a empresa.';
  if (!form.location.addressId) e.addressId = 'Selecione o endereço.';
  if (form.title.trim().length < 2) e.title = 'Informe um título (mínimo 2 caracteres).';
  form.items.forEach((it, i) => {
    if (!it.description.trim()) e[`item${i}`] = 'Descreva o item.';
    else if (!(Number(it.quantity) > 0)) e[`item${i}`] = 'Quantidade inválida.';
    else if (it.unitValue === '' || Number(it.unitValue) < 0 || Number.isNaN(Number(it.unitValue))) e[`item${i}`] = 'Valor inválido.';
  });
  form.equipments.forEach((it, i) => {
    const q = Number(it.quantity);
    if (!Number.isInteger(q) || q < 1) e[`equipment${i}`] = 'Quantidade inválida.';
  });
  if (!isEdit && (form.schedule.time || form.schedule.period) && !form.schedule.date) {
    e.scheduleDate = 'Informe a data do agendamento.';
  }
  return e;
}

/**
 * Criação/edição de OS.
 * order: OS completa (GET /service-orders/:id) para edição; ausente para criação.
 * defaults: { date, client } para criação a partir da agenda ou do cliente.
 */
export default function ServiceOrderFormDialog({ open, onClose, order, defaults, onSaved }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isEdit = Boolean(order);
  const [form, setForm] = useState(() => initialState(order, defaults));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const queryClient = useQueryClient();
  const technicians = useTechnicians();
  const equipmentOptions = useEquipmentOptions(form.location.addressId);

  // Reinicia o formulário a cada abertura (defaults pode ser um objeto novo a cada render do pai)
  useEffect(() => {
    if (open) {
      setForm(initialState(order, defaults));
      setErrors({});
      setServerError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const total = useMemo(
    () => form.items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitValue) || 0), 0),
    [form.items]
  );

  // Equipamentos selecionados continuam visíveis mesmo se não estiverem nas opções atuais
  const equipmentList = useMemo(() => {
    const opts = equipmentOptions.data || [];
    const linked = (order?.equipments || []).map((l) => l.equipment).filter((e) => !opts.some((o) => o.id === e.id));
    return [...opts, ...linked];
  }, [equipmentOptions.data, order]);

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? api.put(`/service-orders/${order.id}`, payload) : api.post('/service-orders', payload),
    meta: { silentError: true },
    onSuccess: (res) => {
      invalidateGroup(queryClient, 'serviceOrder');
      enqueueSnackbar(isEdit ? 'Ordem de serviço atualizada.' : `OS #${res.data.orderNumber} criada.`, { variant: 'success' });
      onSaved?.(res.data);
      onClose();
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  function handleSubmit() {
    const e = validate(form, isEdit);
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError('');
    const payload = {
      clientId: form.location.client.id,
      companyId: form.location.companyId,
      addressId: form.location.addressId,
      title: form.title.trim(),
      type: form.type,
      priority: form.priority,
      technicianId: form.technicianId || null,
      description: form.description,
      dueDate: form.dueDate || null,
      equipments: form.equipments.map((it) => ({ equipmentId: it.equipmentId, quantity: Number(it.quantity) })),
      items: form.items.map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity),
        unitValue: Number(it.unitValue),
      })),
    };
    if (!isEdit && form.schedule.date) {
      payload.schedule = {
        date: form.schedule.date,
        time: form.schedule.time || null,
        period: form.schedule.period || null,
        technicianId: form.technicianId || null,
      };
    }
    mutation.mutate(payload);
  }

  const updateItem = (index, patch) =>
    set({ items: form.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{isEdit ? `Editar OS #${order.orderNumber}` : 'Nova ordem de serviço'}</DialogTitle>
      <DialogContent dividers>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError('')}>
            {serverError}
          </Alert>
        )}

        <Typography variant="overline" color="text.secondary">
          Local do atendimento
        </Typography>
        <Box sx={{ mt: 1, mb: 1 }}>
          <LocationFields
            value={form.location}
            onChange={(location) => set({ location, ...(location.addressId !== form.location.addressId ? { equipments: [] } : {}) })}
            errors={errors}
          />
        </Box>

        <Typography variant="overline" color="text.secondary">
          Serviço
        </Typography>
        <Grid container spacing={2} sx={{ mt: 0, mb: 2 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              required
              label="Título"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              error={Boolean(errors.title)}
              helperText={errors.title}
              inputProps={{ maxLength: 200 }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField select fullWidth label="Tipo" value={form.type} onChange={(e) => set({ type: e.target.value })}>
              {Object.entries(SERVICE_ORDER_TYPE).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField select fullWidth label="Prioridade" value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
              {Object.entries(PRIORITY).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label="Técnico responsável"
              value={technicians.data?.some((t) => t.id === form.technicianId) ? form.technicianId : ''}
              onChange={(e) => set({ technicianId: e.target.value })}
              helperText={technicians.data?.length === 0 ? 'Nenhum técnico cadastrado (cadastre na Agenda).' : ' '}
            >
              <MenuItem value="">Sem técnico definido</MenuItem>
              {(technicians.data || []).map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              type="date"
              fullWidth
              label="Vencimento da cobrança"
              value={form.dueDate}
              onChange={(e) => set({ dueDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Opcional. Se vazio, vence na data de conclusão."
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Descrição"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              inputProps={{ maxLength: 5000 }}
            />
          </Grid>
        </Grid>

        {!isEdit && (
          <>
            <Typography variant="overline" color="text.secondary">
              Agendamento (opcional)
            </Typography>
            <Grid container spacing={2} sx={{ mt: 0, mb: 2 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  type="date"
                  fullWidth
                  label="Data"
                  value={form.schedule.date}
                  onChange={(e) => set({ schedule: { ...form.schedule, date: e.target.value } })}
                  InputLabelProps={{ shrink: true }}
                  error={Boolean(errors.scheduleDate)}
                  helperText={errors.scheduleDate}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  type="time"
                  fullWidth
                  label="Horário"
                  value={form.schedule.time}
                  onChange={(e) => set({ schedule: { ...form.schedule, time: e.target.value } })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  select
                  fullWidth
                  label="Período"
                  value={form.schedule.period}
                  onChange={(e) => set({ schedule: { ...form.schedule, period: e.target.value } })}
                  helperText={form.schedule.time ? 'Deduzido do horário se vazio' : ' '}
                >
                  <MenuItem value="">—</MenuItem>
                  {Object.entries(PERIOD).map(([k, v]) => (
                    <MenuItem key={k} value={k}>
                      {v.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </>
        )}

        <Typography variant="overline" color="text.secondary">
          Equipamentos
        </Typography>
        <Autocomplete
          multiple
          sx={{ mt: 1, mb: 2 }}
          options={equipmentList}
          value={equipmentList.filter((e) => form.equipments.some((it) => it.equipmentId === e.id))}
          onChange={(e, v) =>
            set({
              equipments: v.map((x) => form.equipments.find((it) => it.equipmentId === x.id) || { equipmentId: x.id, quantity: '1' }),
            })
          }
          getOptionLabel={(e) => `${e.equipmentType?.name || 'Equipamento'}${e.serialNumber ? ` · ${e.serialNumber}` : ''}`}
          getOptionDisabled={(e) => e.quantity === 0}
          groupBy={(e) => (e.addressId ? 'Neste endereço' : 'Em estoque')}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          disabled={!form.location.addressId}
          loading={equipmentOptions.isFetching}
          noOptionsText="Nenhum equipamento disponível"
          renderOption={(props, e) => (
            <li {...props} key={e.id}>
              <Box sx={{ flex: 1 }}>
                {e.equipmentType?.name}
                {e.serialNumber && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {' '}· nº {e.serialNumber}
                  </Typography>
                )}
              </Box>
              <Chip
                size="small"
                variant="outlined"
                label={e.status === 'IN_STOCK' ? (e.quantity === 0 ? 'Esgotado' : `${e.quantity} disponíveis`) : `${e.quantity} un. · ${labelOf(EQUIPMENT_STATUS, e.status)}`}
              />
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Vincular equipamentos"
              helperText={
                form.location.addressId
                  ? form.type === 'KIT_REMOVAL'
                    ? 'Ao concluir a retirada, as unidades voltam para o estoque.'
                    : 'Itens "Em estoque" saem do estoque ao concluir a OS e ficam instalados neste endereço.'
                  : 'Selecione o endereço primeiro.'
              }
            />
          )}
        />
        {form.equipments.length > 0 && (
          <Box sx={{ mb: 2, display: 'grid', gap: 1 }}>
            {form.equipments.map((it, i) => {
              const eq = equipmentList.find((x) => x.id === it.equipmentId);
              const fromStock = eq?.status === 'IN_STOCK';
              // A baixa só acontece ao concluir a OS, então o máximo é o disponível agora
              const max = eq?.quantity;
              return (
                <Box key={it.equipmentId} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ flex: '1 1 200px' }}>
                    {eq?.equipmentType?.name || 'Equipamento'}
                    <Typography component="span" variant="caption" color="text.secondary">
                      {fromStock ? ' · sai do estoque' : ' · neste endereço'}
                    </Typography>
                  </Typography>
                  <TextField
                    size="small"
                    type="number"
                    label="Quantidade"
                    value={it.quantity}
                    onChange={(ev) =>
                      set({ equipments: form.equipments.map((x, j) => (j === i ? { ...x, quantity: ev.target.value } : x)) })
                    }
                    inputProps={{ min: 1, max, step: 1 }}
                    error={Boolean(errors[`equipment${i}`])}
                    helperText={errors[`equipment${i}`] || (max !== undefined ? `de ${max}` : ' ')}
                    sx={{ width: 130 }}
                  />
                </Box>
              );
            })}
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="overline" color="text.secondary">
            Itens e valores
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => set({ items: [...form.items, { ...emptyItem }] })}>
            Adicionar item
          </Button>
        </Box>
        {form.items.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Sem itens: a OS não gera cobrança.
          </Typography>
        )}
        {form.items.map((it, i) => (
          <Grid container spacing={1.5} key={i} sx={{ mt: 0, alignItems: 'flex-start' }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Descrição"
                value={it.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                error={Boolean(errors[`item${i}`])}
                helperText={errors[`item${i}`]}
              />
            </Grid>
            <Grid item xs={4} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Qtd."
                value={it.quantity}
                onChange={(e) => updateItem(i, { quantity: e.target.value })}
                inputProps={{ min: 1, step: 1 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Valor unit."
                value={it.unitValue}
                onChange={(e) => updateItem(i, { unitValue: e.target.value })}
                inputProps={{ min: 0, step: '0.01' }}
                InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={2} sm={1}>
              <Tooltip title="Remover item">
                <IconButton onClick={() => set({ items: form.items.filter((_, j) => j !== i) })} aria-label="Remover item">
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        ))}
        {form.items.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography align="right" fontWeight={700}>
              Total: {formatCurrency(total)}
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar OS'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
