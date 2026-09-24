import { Grid, MenuItem, TextField } from '@mui/material';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export const emptyAddress = {
  label: 'Principal',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  reference: '',
};

export function validateAddress(a, prefix = '') {
  const e = {};
  if (!a.street?.trim()) e[`${prefix}street`] = 'Informe o logradouro.';
  if (!a.city?.trim()) e[`${prefix}city`] = 'Informe a cidade.';
  return e;
}

/** Campos de endereço reutilizados em cliente, empresa e endereço. */
export default function AddressFields({ value, onChange, errors = {}, prefix = '', showLabel = true }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const err = (field) => errors[`${prefix}${field}`];
  return (
    <Grid container spacing={2}>
      {showLabel && (
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Identificação" placeholder="Ex.: Matriz, Filial Centro, Casa" value={value.label || ''} onChange={set('label')} inputProps={{ maxLength: 60 }} />
        </Grid>
      )}
      <Grid item xs={12} sm={showLabel ? 6 : 4}>
        <TextField fullWidth label="CEP" value={value.zipCode || ''} onChange={set('zipCode')} inputProps={{ maxLength: 10 }} />
      </Grid>
      <Grid item xs={12} sm={8}>
        <TextField fullWidth required label="Logradouro" value={value.street || ''} onChange={set('street')} error={Boolean(err('street'))} helperText={err('street')} />
      </Grid>
      <Grid item xs={4} sm={4}>
        <TextField fullWidth label="Número" value={value.number || ''} onChange={set('number')} inputProps={{ maxLength: 20 }} />
      </Grid>
      <Grid item xs={8} sm={6}>
        <TextField fullWidth label="Complemento" value={value.complement || ''} onChange={set('complement')} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth label="Bairro" value={value.district || ''} onChange={set('district')} />
      </Grid>
      <Grid item xs={8} sm={8}>
        <TextField fullWidth required label="Cidade" value={value.city || ''} onChange={set('city')} error={Boolean(err('city'))} helperText={err('city')} />
      </Grid>
      <Grid item xs={4} sm={4}>
        <TextField select fullWidth label="UF" value={value.state || ''} onChange={set('state')}>
          <MenuItem value="">—</MenuItem>
          {UFS.map((uf) => (
            <MenuItem key={uf} value={uf}>
              {uf}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12}>
        <TextField fullWidth label="Ponto de referência" value={value.reference || ''} onChange={set('reference')} />
      </Grid>
    </Grid>
  );
}
