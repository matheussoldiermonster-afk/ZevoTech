import { useEffect } from 'react';
import { Grid, MenuItem, TextField } from '@mui/material';
import ClientPicker from './ClientPicker';
import { useAddressesOfCompany, useCompaniesOfClient } from '../../lib/lookups';
import { formatAddress } from '../../utils/address';

/**
 * Cascata Cliente → Empresa → Endereço.
 * value: { client: {id,name}|null, companyId: string, addressId: string }
 * Quando só existe uma opção, ela é selecionada automaticamente.
 */
export default function LocationFields({ value, onChange, errors = {}, requireAddress = true, disabled }) {
  const clientId = value.client?.id;
  const companies = useCompaniesOfClient(clientId);
  const addresses = useAddressesOfCompany(value.companyId);

  // Seleção automática quando há apenas uma empresa/endereço
  useEffect(() => {
    if (clientId && !value.companyId && companies.data?.length === 1) {
      onChange({ ...value, companyId: companies.data[0].id, addressId: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, companies.data]);

  useEffect(() => {
    if (value.companyId && !value.addressId && addresses.data?.length) {
      const main = addresses.data.length === 1 ? addresses.data[0] : addresses.data.find((a) => a.isMain);
      if (main) onChange({ ...value, addressId: main.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.companyId, addresses.data]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <ClientPicker
          required
          value={value.client}
          disabled={disabled}
          onChange={(client) => onChange({ client, companyId: '', addressId: '' })}
          error={Boolean(errors.client)}
          helperText={errors.client}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <TextField
          select
          fullWidth
          required
          label="Empresa"
          value={companies.data?.some((c) => c.id === value.companyId) ? value.companyId : ''}
          onChange={(e) => onChange({ ...value, companyId: e.target.value, addressId: '' })}
          disabled={disabled || !clientId || companies.isLoading}
          error={Boolean(errors.companyId)}
          helperText={
            errors.companyId ||
            (clientId && companies.data?.length === 0 ? 'Cliente sem empresa. Cadastre uma em Clientes.' : ' ')
          }
        >
          {(companies.data || []).map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
              {c.tradeName ? ` (${c.tradeName})` : ''}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <TextField
          select
          fullWidth
          required={requireAddress}
          label="Endereço"
          value={addresses.data?.some((a) => a.id === value.addressId) ? value.addressId : ''}
          onChange={(e) => onChange({ ...value, addressId: e.target.value })}
          disabled={disabled || !value.companyId || addresses.isLoading}
          error={Boolean(errors.addressId)}
          helperText={
            errors.addressId ||
            (value.companyId && addresses.data?.length === 0 ? 'Empresa sem endereço. Cadastre um em Clientes.' : ' ')
          }
        >
          {!requireAddress && <MenuItem value="">Nenhum específico</MenuItem>}
          {(addresses.data || []).map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {formatAddress(a, { withLabel: true })}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
    </Grid>
  );
}
