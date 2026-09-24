import { useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { useClientSearch } from '../../lib/lookups';

/**
 * Seleção de cliente com busca no servidor (nome, documento, empresa ou endereço).
 * value: { id, name } | null
 */
export default function ClientPicker({ value, onChange, error, helperText, disabled, label = 'Cliente', required }) {
  const [input, setInput] = useState('');
  const debounced = useDebouncedValue(input.trim(), 300);
  const q = useClientSearch(debounced);
  const options = q.data || [];

  return (
    <Autocomplete
      value={value}
      onChange={(e, v) => onChange(v)}
      inputValue={input}
      onInputChange={(e, v) => setInput(v)}
      options={value && !options.some((o) => o.id === value.id) ? [value, ...options] : options}
      getOptionLabel={(o) => o?.name || ''}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      filterOptions={(x) => x}
      loading={q.isFetching}
      disabled={disabled}
      noOptionsText={debounced ? 'Nenhum cliente encontrado' : 'Digite para buscar'}
      loadingText="Buscando…"
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {q.isFetching ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
