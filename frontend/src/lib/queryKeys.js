/** Chaves de cache centralizadas (facilita a invalidação após mutações). */
export const queryKeys = {
  dashboard: {
    all: ['dashboard'],
    kpis: (month) => ['dashboard', 'kpis', month],
    operations: (month) => ['dashboard', 'operations', month],
    equipment: () => ['dashboard', 'equipment'],
  },
  finance: {
    all: ['finance'],
    summary: (month) => ['finance', 'summary', month],
    series: (from, to) => ['finance', 'series', from, to],
    receivables: (params) => ['finance', 'receivables', params],
  },
  alerts: ['alerts'],
  schedules: {
    all: ['schedules'],
    range: (params) => ['schedules', params],
  },
  monthlyPayments: {
    all: ['monthly-payments'],
    list: (params) => ['monthly-payments', params],
  },
  clients: {
    all: ['clients'],
    list: (params) => ['clients', 'list', params],
    detail: (id) => ['clients', 'detail', id],
    search: (text) => ['clients', 'search', text],
  },
  companies: {
    all: ['companies'],
    byClient: (clientId) => ['companies', 'by-client', clientId],
  },
  addresses: {
    all: ['addresses'],
    byCompany: (companyId) => ['addresses', 'by-company', companyId],
  },
  technicians: {
    all: ['technicians'],
    list: (includeInactive) => ['technicians', includeInactive ? 'all' : 'active'],
  },
  serviceOrders: {
    all: ['service-orders'],
    list: (params) => ['service-orders', 'list', params],
    detail: (id) => ['service-orders', 'detail', id],
  },
  equipments: {
    all: ['equipments'],
    options: (params) => ['equipments', 'options', params],
    list: (params) => ['equipments', 'list', params],
    detail: (id) => ['equipments', 'detail', id],
    movements: (id) => ['equipments', 'movements', id],
  },
  equipmentTypes: {
    all: ['equipment-types'],
  },
  contracts: {
    all: ['contracts'],
    list: (params) => ['contracts', 'list', params],
    detail: (id) => ['contracts', 'detail', id],
  },
};

/**
 * Grupos invalidados após mutações de cada tipo de dado.
 * Ex.: alterar uma OS afeta lista de OS, agenda, dashboard, alertas e financeiro.
 */
export const invalidationGroups = {
  serviceOrder: [['service-orders'], ['schedules'], ['dashboard'], ['alerts'], ['finance'], ['equipments'], ['clients']],
  schedule: [['schedules'], ['service-orders'], ['dashboard'], ['alerts']],
  client: [['clients'], ['companies'], ['addresses'], ['dashboard'], ['alerts']],
  technician: [['technicians'], ['schedules'], ['service-orders']],
  contract: [['contracts'], ['finance'], ['monthly-payments'], ['dashboard'], ['alerts'], ['clients']],
  payment: [['finance'], ['monthly-payments'], ['contracts'], ['service-orders'], ['dashboard'], ['alerts']],
  equipment: [['equipments'], ['equipment-types'], ['dashboard'], ['alerts'], ['clients'], ['service-orders']],
};

export function invalidateGroup(queryClient, group) {
  for (const key of invalidationGroups[group]) queryClient.invalidateQueries({ queryKey: key });
}
