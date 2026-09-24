/** Rótulos e cores únicos para todo o sistema. */
export const SERVICE_ORDER_STATUS = {
  OPEN: { label: 'Aberta', color: 'info' },
  IN_PROGRESS: { label: 'Em andamento', color: 'warning' },
  COMPLETED: { label: 'Concluída', color: 'success' },
  CANCELLED: { label: 'Cancelada', color: 'default' },
};

export const SERVICE_ORDER_TYPE = {
  INSTALLATION: { label: 'Instalação' },
  CORRECTIVE: { label: 'Corretiva' },
  PREVENTIVE: { label: 'Preventiva' },
  KIT_REMOVAL: { label: 'Retirada de kit' },
  OTHER: { label: 'Outro' },
};

export const PRIORITY = {
  LOW: { label: 'Baixa', color: 'default' },
  NORMAL: { label: 'Normal', color: 'info' },
  HIGH: { label: 'Alta', color: 'warning' },
  URGENT: { label: 'Urgente', color: 'error' },
};

export const PAYMENT_STATUS = {
  PENDING: { label: 'Pendente', color: 'warning' },
  PAID: { label: 'Pago', color: 'success' },
  OVERDUE: { label: 'Atrasado', color: 'error' },
  CANCELLED: { label: 'Cancelado', color: 'default' },
};

export const EQUIPMENT_STATUS = {
  IN_STOCK: { label: 'Em estoque', color: 'info' },
  INSTALLED: { label: 'Instalado', color: 'success' },
  MAINTENANCE: { label: 'Em manutenção', color: 'warning' },
  DAMAGED: { label: 'Danificado', color: 'error' },
  DISCARDED: { label: 'Descartado', color: 'default' },
};

export const PERIOD = {
  MORNING: { label: 'Manhã' },
  AFTERNOON: { label: 'Tarde' },
  EVENING: { label: 'Noite' },
};

export const ALERT_SEVERITY = {
  critical: { emoji: '🔴', label: 'Crítico', color: 'error' },
  high: { emoji: '🟠', label: 'Alto', color: 'warning' },
  medium: { emoji: '🟡', label: 'Atenção', color: 'warning' },
  info: { emoji: '🟢', label: 'Informativo', color: 'success' },
  ok: { emoji: '🟢', label: 'Em dia', color: 'success' },
};

export function labelOf(map, key) {
  return map[key]?.label || key || '—';
}

export const CONTRACT_STATUS = {
  ACTIVE: { label: 'Ativo', color: 'success' },
  SUSPENDED: { label: 'Suspenso', color: 'warning' },
  CANCELLED: { label: 'Cancelado', color: 'default' },
  ENDED: { label: 'Encerrado', color: 'default' },
};

export const PERIODICITY = {
  MONTHLY: { label: 'Mensal', months: 1 },
  QUARTERLY: { label: 'Trimestral', months: 3 },
  SEMIANNUAL: { label: 'Semestral', months: 6 },
  ANNUAL: { label: 'Anual', months: 12 },
};

export const PAYMENT_METHOD = {
  PIX: { label: 'Pix' },
  BOLETO: { label: 'Boleto' },
  BANK_TRANSFER: { label: 'Transferência' },
  CASH: { label: 'Dinheiro' },
  DEBIT_CARD: { label: 'Cartão de débito' },
  CREDIT_CARD: { label: 'Cartão de crédito' },
};

export const MOVEMENT_TYPE = {
  ENTRY: { label: 'Entrada no estoque' },
  INSTALL: { label: 'Instalação' },
  REMOVE: { label: 'Retirada para o estoque' },
  TRANSFER: { label: 'Transferência' },
  TO_MAINTENANCE: { label: 'Enviado para manutenção' },
  FROM_MAINTENANCE: { label: 'Retorno da manutenção' },
  DAMAGED: { label: 'Marcado como danificado' },
  DISCARD: { label: 'Descartado' },
  STATUS_CHANGE: { label: 'Mudança de situação' },
  EXIT: { label: 'Saída do estoque' },
};
