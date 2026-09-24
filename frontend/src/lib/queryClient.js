import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { getErrorMessage } from '../services/api';

/**
 * Política de cache (Etapa 2):
 *  - Listas: 30 s de validade; recarrega ao voltar para a aba e após mutações.
 *  - Auxiliares (tipos, técnicos): 30 min (definido na própria query).
 *  - Dashboard/alertas: 60 s + polling de 2 min só com a aba visível.
 */
function shouldRetry(failureCount, error) {
  const status = error?.response?.status;
  if (status && status >= 400 && status < 500) return false; // erro do usuário/permissão: não insistir
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Só avisa por toast quando já havia dados na tela (atualização em segundo plano falhou).
      // Falhas no primeiro carregamento aparecem como estado de erro no próprio bloco.
      if (query.state.data !== undefined && error?.response?.status !== 401) {
        enqueueSnackbar(`Não foi possível atualizar os dados: ${getErrorMessage(error)}`, {
          variant: 'warning',
          preventDuplicate: true,
        });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, variables, context, mutation) => {
      if (mutation.options.meta?.silentError) return;
      enqueueSnackbar(getErrorMessage(error), { variant: 'error' });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: shouldRetry,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});

export const DASHBOARD_QUERY_OPTIONS = {
  staleTime: 60 * 1000,
  refetchInterval: 2 * 60 * 1000,
  refetchIntervalInBackground: false,
};

export const AUX_QUERY_OPTIONS = {
  staleTime: 30 * 60 * 1000,
};
