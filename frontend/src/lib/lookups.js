import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { queryKeys } from './queryKeys';
import { AUX_QUERY_OPTIONS } from './queryClient';

const get = (url, params) => api.get(url, { params }).then((r) => r.data);

/** Técnicos ativos (cache longo; invalidado ao editar técnicos). */
export function useTechnicians() {
  return useQuery({
    queryKey: queryKeys.technicians.list(false),
    queryFn: () => get('/technicians'),
    ...AUX_QUERY_OPTIONS,
  });
}

/** Busca de clientes para autocomplete (primeiros 20 resultados). */
export function useClientSearch(text) {
  return useQuery({
    queryKey: queryKeys.clients.search(text),
    queryFn: () => get('/clients', { page: 1, pageSize: 20, search: text || undefined }).then((r) => r.data),
    staleTime: 60 * 1000,
  });
}

export function useCompaniesOfClient(clientId) {
  return useQuery({
    queryKey: queryKeys.companies.byClient(clientId),
    queryFn: () => get('/companies', { clientId }),
    enabled: Boolean(clientId),
    staleTime: 60 * 1000,
  });
}

export function useAddressesOfCompany(companyId) {
  return useQuery({
    queryKey: queryKeys.addresses.byCompany(companyId),
    queryFn: () => get('/addresses', { companyId }),
    enabled: Boolean(companyId),
    staleTime: 60 * 1000,
  });
}

/**
 * Equipamentos que podem ser vinculados a uma OS naquele endereço:
 * os que já estão no endereço + os disponíveis em estoque (para instalação).
 */
export function useEquipmentOptions(addressId) {
  return useQuery({
    queryKey: queryKeys.equipments.options({ addressId }),
    queryFn: async () => {
      const [atAddress, inStock] = await Promise.all([
        addressId ? get('/equipments', { addressId }) : Promise.resolve([]),
        get('/equipments', { status: 'IN_STOCK', page: 1, pageSize: 100 }).then((r) => r.data),
      ]);
      const seen = new Set();
      return [...atAddress, ...inStock].filter((e) => (seen.has(e.id) ? false : seen.add(e.id)));
    },
    enabled: Boolean(addressId),
    staleTime: 30 * 1000,
  });
}
