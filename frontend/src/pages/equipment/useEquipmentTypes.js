import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';

/** Tipos de equipamento com contagens por situação e alerta de estoque mínimo. */
export default function useEquipmentTypes() {
  return useQuery({
    queryKey: queryKeys.equipmentTypes.all,
    queryFn: () => api.get('/equipment-types').then((r) => r.data),
    staleTime: 60 * 1000,
  });
}
