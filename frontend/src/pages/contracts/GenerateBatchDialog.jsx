import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemText, TextField, Typography } from '@mui/material';
import api from '../../services/api';
import { invalidateGroup } from '../../lib/queryKeys';
import { currentMonthISO, formatCurrency, formatMonth } from '../../utils/format';

/** Gera as cobranças de um mês para todos os contratos ativos. */
export default function GenerateBatchDialog({ open, onClose }) {
  const [month, setMonth] = useState(currentMonthISO());
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setMonth(currentMonthISO());
      setResult(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => api.post('/contracts/generate-payments', { reference: month }).then((r) => r.data),
    onSuccess: (data) => {
      invalidateGroup(queryClient, 'contract');
      setResult(data);
    },
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Gerar cobranças do mês</DialogTitle>
      <DialogContent>
        {!result ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Cria as cobranças de todos os contratos ativos que devem cobrar no mês escolhido, respeitando a
              periodicidade e a vigência de cada um. Cobranças já existentes não são duplicadas.
            </Typography>
            <TextField type="month" fullWidth label="Mês de referência" value={month} onChange={(e) => setMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
          </>
        ) : (
          <>
            <Alert severity={result.created ? 'success' : 'info'} sx={{ mb: 1 }}>
              {result.created
                ? `${result.created} cobrança(s) criada(s) para ${formatMonth(result.reference).toLowerCase()}, total de ${formatCurrency(result.totalAmount)}.`
                : `Nenhuma cobrança nova para ${formatMonth(result.reference).toLowerCase()}.`}
            </Alert>
            <List dense>
              <ListItem disableGutters>
                <ListItemText primary={`${result.activeContracts} contrato(s) ativo(s)`} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText primary={`${result.alreadyExisted} já tinham cobrança neste mês`} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary={`${result.notInCycle} fora do ciclo`}
                  secondary="Periodicidade não cobra neste mês, ou fora da vigência."
                />
              </ListItem>
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          {result ? 'Fechar' : 'Cancelar'}
        </Button>
        {!result && (
          <Button variant="contained" disabled={!month || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Gerando…' : 'Gerar cobranças'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
