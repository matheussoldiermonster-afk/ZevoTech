import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Grid,
  LinearProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import BackupIcon from '@mui/icons-material/BackupOutlined';
import api, { getErrorMessage } from '../../services/api';
import SectionCard from '../../components/common/SectionCard';
import { formatDateTime } from '../../utils/format';

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** "zevo_2026-09-24_02-00-00.dump" → "24/09/2026 02:00" */
function fileDate(name) {
  const m = /^zevo_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})/.exec(name);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : name;
}

function Info({ label, children }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ wordBreak: 'break-all' }}>
        {children}
      </Typography>
    </Box>
  );
}

function StatusBanner({ b }) {
  if (!b.enabled) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        O backup automático está <strong>desativado</strong>. Peça para ativar <code>BACKUP_ENABLED=true</code> no servidor.
      </Alert>
    );
  }
  const failed = b.lastAttempt && b.lastAttempt.ok === false;
  if (failed && (!b.lastSuccess || b.lastAttempt.at !== b.lastSuccess.at)) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <strong>O último backup falhou</strong> em {formatDateTime(b.lastAttempt.at)}: {b.lastAttempt.error}
      </Alert>
    );
  }
  if (!b.lastSuccess) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Nenhum backup realizado ainda. O primeiro automático acontece às {b.time}, ou faça um agora.
      </Alert>
    );
  }
  if (b.hoursSinceSuccess > 26) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <strong>Último backup há {Math.floor(b.hoursSinceSuccess)} horas.</strong> O backup diário não está sendo feito; verifique se o servidor está ligado.
      </Alert>
    );
  }
  return (
    <Alert severity={failed ? 'warning' : 'success'} sx={{ mb: 2 }}>
      Último backup em <strong>{formatDateTime(b.lastSuccess.at)}</strong> ({formatSize(b.lastSuccess.size)}, verificado).
      {failed && <> A cópia para a segunda pasta falhou: {b.lastAttempt.error}</>}
    </Alert>
  );
}

export default function BackupCard() {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get('/backups').then((r) => r.data),
    refetchInterval: 60 * 1000,
  });
  const b = q.data;

  const runNow = useMutation({
    mutationFn: () => api.post('/backups/run', null, { timeout: 30 * 60 * 1000 }).then((r) => r.data),
    meta: { silentError: true },
    onSuccess: (r) => {
      enqueueSnackbar(r.warning ? `Backup feito, com aviso: ${r.warning}` : `Backup concluído (${formatSize(r.size)}).`, {
        variant: r.warning ? 'warning' : 'success',
      });
    },
    onError: (err) => enqueueSnackbar(`Backup falhou: ${getErrorMessage(err)}`, { variant: 'error', autoHideDuration: 10000 }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  return (
    <SectionCard
      title="Backup do banco de dados"
      subtitle="Cópia de segurança de todos os dados do sistema"
      icon={<BackupIcon color="primary" />}
      action={
        <Button variant="contained" onClick={() => runNow.mutate()} disabled={runNow.isPending || !b}>
          {runNow.isPending ? 'Fazendo backup…' : 'Fazer backup agora'}
        </Button>
      }
      loading={q.isLoading}
      error={q.isError && !b ? q.error : null}
      onRetry={q.refetch}
      skeleton={<Skeleton variant="rounded" height={240} />}
    >
      {runNow.isPending && <LinearProgress sx={{ mb: 2 }} />}
      {b && (
        <>
          <StatusBanner b={b} />

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Info label="Backup automático">{b.enabled ? `Todo dia às ${b.time}` : 'Desativado'}</Info>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Info label="Guardamos">
                {b.keep.daily} diários, {b.keep.weekly} semanais e {b.keep.monthly} mensais
              </Info>
            </Grid>
            <Grid item xs={12} md={6}>
              <Info label="Pasta principal">{b.dir}</Info>
            </Grid>
            <Grid item xs={12}>
              {b.copyDir ? (
                <Info label="Segunda cópia">{b.copyDir}</Info>
              ) : (
                <Alert severity="warning" variant="outlined">
                  <strong>Sem segunda cópia.</strong> Se o disco do servidor falhar, os backups se perdem junto. Configure{' '}
                  <code>BACKUP_COPY_DIR</code> com uma pasta sincronizada (Google Drive, OneDrive, Dropbox) ou um HD externo.
                </Alert>
              )}
            </Grid>
          </Grid>

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Backups guardados ({b.files.length})
          </Typography>
          {b.files.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum backup na pasta principal.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto', maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Arquivo</TableCell>
                    <TableCell align="right">Tamanho</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {b.files.map((f) => (
                    <TableRow key={f.file}>
                      <TableCell>{fileDate(f.file)}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{f.file}</TableCell>
                      <TableCell align="right">{formatSize(f.size)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Para restaurar um backup, siga o guia BACKUP.md do projeto. A restauração é feita no servidor, por segurança, e
            nunca por esta tela.
          </Typography>
        </>
      )}
    </SectionCard>
  );
}
