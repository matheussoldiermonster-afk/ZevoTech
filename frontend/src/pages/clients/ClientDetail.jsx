import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Grid,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import BusinessIcon from '@mui/icons-material/BusinessOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import WarningIcon from '@mui/icons-material/WarningAmberOutlined';
import api from '../../services/api';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusChip from '../../components/common/StatusChip';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateGroup, queryKeys } from '../../lib/queryKeys';
import { CONTRACT_STATUS, SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, labelOf } from '../../constants/labels';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { formatAddress, isAddressIncomplete } from '../../utils/address';
import { formatDocument, formatPhone } from '../../utils/document';
import ClientFormDialog from './ClientFormDialog';
import CompanyFormDialog from './CompanyFormDialog';
import AddressFormDialog from './AddressFormDialog';
import ServiceOrderFormDialog from '../service-orders/ServiceOrderFormDialog';

function AddressRow({ address, isAdmin, onEdit, onRemove, onMakeMain }) {
  const incomplete = isAddressIncomplete(address);
  return (
    <ListItem
      disableGutters
      sx={{ pl: 1, alignItems: 'flex-start' }}
      secondaryAction={
        isAdmin ? (
          <Box sx={{ display: 'flex' }}>
            {!address.isMain && (
              <Tooltip title="Tornar principal">
                <IconButton size="small" onClick={onMakeMain} aria-label="Tornar endereço principal">
                  <StarBorderIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Editar endereço">
              <IconButton size="small" onClick={onEdit} aria-label="Editar endereço">
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Remover endereço">
              <IconButton size="small" onClick={onRemove} aria-label="Remover endereço">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : null
      }
    >
      <PlaceIcon fontSize="small" color={incomplete ? 'warning' : 'action'} sx={{ mr: 1, mt: 0.5 }} />
      <ListItemText
        sx={{ pr: isAdmin ? 13 : 0 }}
        primary={
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <strong>{address.label}</strong>
            {address.isMain && <Chip size="small" icon={<StarIcon />} label="principal" sx={{ height: 20 }} />}
            {incomplete && <Chip size="small" color="warning" variant="outlined" label="incompleto" sx={{ height: 20 }} />}
          </Box>
        }
        secondary={
          <>
            {formatAddress(address)}
            <Typography component="span" variant="caption" display="block" color="text.secondary">
              {address.equipments ? address.equipments.reduce((sum, eq) => sum + eq.quantity, 0) : address._count?.equipments ?? 0}{' '}
              equipamento(s) · {address._count?.serviceOrders ?? 0} OS
            </Typography>
          </>
        }
        secondaryTypographyProps={{ component: 'div' }}
      />
    </ListItem>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [dialog, setDialog] = useState(null); // { type, data }

  const q = useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: () => api.get(`/clients/${id}`).then((r) => r.data),
  });
  const client = q.data;

  const action = useMutation({
    mutationFn: ({ method, url, body }) => api[method](url, body),
    onSuccess: (res, vars) => {
      invalidateGroup(queryClient, 'client');
      enqueueSnackbar(vars.success, { variant: 'success' });
    },
  });

  async function toggleClient() {
    if (client.active) {
      const ok = await confirm({
        title: `Desativar ${client.name}?`,
        message: 'O cliente deixa de aparecer nas listas e buscas. Histórico, OS e cobranças são mantidos. É possível reativar depois.',
        confirmText: 'Desativar',
        danger: true,
      });
      if (!ok) return;
      action.mutate({ method: 'delete', url: `/clients/${id}`, success: 'Cliente desativado.' });
    } else {
      action.mutate({ method: 'put', url: `/clients/${id}`, body: { active: true }, success: 'Cliente reativado.' });
    }
  }

  async function toggleCompany(company) {
    if (company.active) {
      const ok = await confirm({
        title: `Desativar a empresa ${company.name}?`,
        message: 'Ela deixa de aparecer para novas OS e contratos. Não é possível desativar empresas com contratos ativos.',
        confirmText: 'Desativar',
        danger: true,
      });
      if (!ok) return;
      action.mutate({ method: 'delete', url: `/companies/${company.id}`, success: 'Empresa desativada.' });
    } else {
      action.mutate({ method: 'put', url: `/companies/${company.id}`, body: { active: true }, success: 'Empresa reativada.' });
    }
  }

  async function removeAddress(address) {
    const ok = await confirm({
      title: `Remover o endereço "${address.label}"?`,
      message: 'Não é possível remover endereços com equipamentos instalados ou OS em aberto.',
      confirmText: 'Remover',
      danger: true,
    });
    if (ok) action.mutate({ method: 'delete', url: `/addresses/${address.id}`, success: 'Endereço removido.' });
  }

  if (q.isLoading) {
    return (
      <>
        <Skeleton height={48} width={320} />
        <Skeleton variant="rounded" height={140} sx={{ my: 2 }} />
        <Skeleton variant="rounded" height={260} />
      </>
    );
  }
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;

  const companies = client.companies || [];
  const activeCompanies = companies.filter((c) => c.active);
  const inactiveCompanies = companies.filter((c) => !c.active);

  return (
    <>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/clientes" underline="hover" color="inherit">
          Clientes
        </Link>
        <Typography color="text.primary">{client.name}</Typography>
      </Breadcrumbs>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {client.name} {!client.active && <Chip label="inativo" size="small" />}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {client.documentType} {formatDocument(client.document)} · {formatPhone(client.phone)}
              {client.email ? ` · ${client.email}` : ''}
            </Typography>
            {client.notes && (
              <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                {client.notes}
              </Typography>
            )}
          </Box>
          {isAdmin && (
            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {client.active && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ type: 'order' })}>
                  Nova OS
                </Button>
              )}
              <Button startIcon={<EditIcon />} onClick={() => setDialog({ type: 'client' })}>
                Editar
              </Button>
              <Button color={client.active ? 'error' : 'primary'} onClick={toggleClient}>
                {client.active ? 'Desativar' : 'Reativar'}
              </Button>
            </Stack>
          )}
        </Box>
      </Paper>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
        <Tab label={`Empresas e endereços (${activeCompanies.length})`} />
        <Tab label={`Ordens de serviço (${client.serviceOrders.length}${client.serviceOrders.length === 50 ? '+' : ''})`} />
        <Tab label={`Contratos (${client.contracts.length})`} />
      </Tabs>

      {tab === 0 && (
        <>
          {isAdmin && client.active && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
              <Button startIcon={<AddIcon />} onClick={() => setDialog({ type: 'company' })}>
                Nova empresa
              </Button>
            </Box>
          )}
          {activeCompanies.length === 0 && (
            <EmptyState title="Nenhuma empresa ativa" description="Cadastre uma empresa para abrir OS e contratos." />
          )}
          <Grid container spacing={2}>
            {[...activeCompanies, ...inactiveCompanies].map((company) => {
              const addresses = company.addresses.filter((a) => a.active);
              return (
                <Grid item xs={12} lg={6} key={company.id}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%', opacity: company.active ? 1 : 0.6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <BusinessIcon color="primary" sx={{ mt: 0.25 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={700}>
                          {company.name} {!company.active && <Chip size="small" label="inativa" />}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {[company.tradeName, company.document && `CNPJ ${formatDocument(company.document)}`, company.phone && formatPhone(company.phone)]
                            .filter(Boolean)
                            .join(' · ') || 'Sem dados complementares'}
                        </Typography>
                      </Box>
                      {isAdmin && (
                        <Box sx={{ display: 'flex', flexShrink: 0 }}>
                          {company.active && (
                            <Tooltip title="Editar empresa">
                              <IconButton size="small" onClick={() => setDialog({ type: 'company', data: company })} aria-label="Editar empresa">
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Button size="small" color={company.active ? 'error' : 'primary'} onClick={() => toggleCompany(company)}>
                            {company.active ? 'Desativar' : 'Reativar'}
                          </Button>
                        </Box>
                      )}
                    </Box>
                    {company.active && (
                      <>
                        {addresses.some(isAddressIncomplete) && (
                          <Alert severity="warning" icon={<WarningIcon fontSize="small" />} sx={{ py: 0, mb: 1 }}>
                            Há endereço incompleto. Complete para facilitar os atendimentos.
                          </Alert>
                        )}
                        <List dense disablePadding>
                          {addresses.map((a) => (
                            <AddressRow
                              key={a.id}
                              address={a}
                              isAdmin={isAdmin}
                              onEdit={() => setDialog({ type: 'address', data: a, companyId: company.id })}
                              onRemove={() => removeAddress(a)}
                              onMakeMain={() => action.mutate({ method: 'put', url: `/addresses/${a.id}`, body: { isMain: true }, success: 'Endereço principal alterado.' })}
                            />
                          ))}
                        </List>
                        {isAdmin && (
                          <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => setDialog({ type: 'address', companyId: company.id })}>
                            Adicionar endereço
                          </Button>
                        )}
                      </>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      {tab === 1 && (
        <Paper variant="outlined">
          {client.serviceOrders.length === 0 ? (
            <EmptyState title="Nenhuma OS para este cliente" />
          ) : (
            <List disablePadding>
              {client.serviceOrders.map((os) => (
                <ListItemButton key={os.id} divider onClick={() => navigate(`/ordens-servico?os=${os.id}`)}>
                  <ListItemText
                    primary={`#${os.orderNumber} · ${os.title}`}
                    secondary={`${labelOf(SERVICE_ORDER_TYPE, os.type)} · aberta em ${formatDateTime(os.openedAt)}`}
                  />
                  <StatusChip map={SERVICE_ORDER_STATUS} value={os.status} />
                </ListItemButton>
              ))}
            </List>
          )}
          {client.serviceOrders.length === 50 && (
            <Box sx={{ p: 1.5, textAlign: 'center' }}>
              <Button onClick={() => navigate(`/ordens-servico?clientId=${client.id}`)}>Ver todas as OS deste cliente</Button>
            </Box>
          )}
        </Paper>
      )}

      {tab === 2 && (
        <Paper variant="outlined">
          {client.contracts.length === 0 ? (
            <EmptyState title="Nenhum contrato para este cliente" />
          ) : (
            <List disablePadding>
              {client.contracts.map((c) => (
                <ListItem key={c.id} divider secondaryAction={<StatusChip map={CONTRACT_STATUS} value={c.status || (c.active ? 'ACTIVE' : 'CANCELLED')} />}>
                  <ListItemText
                    primary={`${formatCurrency(c.monthlyValue)}/mês · vencimento dia ${c.dueDay}`}
                    secondary={`Início em ${formatDate(c.startDate)}${c.endDate ? ` · término em ${formatDate(c.endDate)}` : ''}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}

      <ClientFormDialog open={dialog?.type === 'client'} client={client} onClose={() => setDialog(null)} />
      <CompanyFormDialog open={dialog?.type === 'company'} company={dialog?.data} clientId={client.id} onClose={() => setDialog(null)} />
      <AddressFormDialog open={dialog?.type === 'address'} address={dialog?.data} companyId={dialog?.companyId} onClose={() => setDialog(null)} />
      <ServiceOrderFormDialog
        open={dialog?.type === 'order'}
        defaults={{ client: { id: client.id, name: client.name } }}
        onClose={() => setDialog(null)}
        onSaved={(os) => navigate(`/ordens-servico?os=${os.id}`)}
      />
    </>
  );
}
