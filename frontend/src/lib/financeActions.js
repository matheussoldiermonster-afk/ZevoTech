import api from '../services/api';

/**
 * Ações sobre uma cobrança ("recebível"), independentemente da origem.
 * receivable: { source: 'CONTRACT' | 'SERVICE_ORDER', id }
 * Contrato → /monthly-payments/:id   ·   OS → /service-orders/:id/payment
 */
function send(r, contractBody, orderBody) {
  return r.source === 'CONTRACT'
    ? api.put(`/monthly-payments/${r.id}`, contractBody)
    : api.patch(`/service-orders/${r.id}/payment`, orderBody);
}

export const financeActions = {
  pay: (r, { paidAt, method } = {}) =>
    send(
      r,
      { status: 'PAID', paidAt: paidAt || null, method: method || null },
      { paymentStatus: 'PAID', paidAt: paidAt || null, paymentMethod: method || null }
    ),
  /** Estorno: volta para pendente e apaga a data de pagamento (o backend limpa paidAt). */
  refund: (r) => send(r, { status: 'PENDING' }, { paymentStatus: 'PENDING' }),
  cancel: (r) => send(r, { status: 'CANCELLED' }, { paymentStatus: 'CANCELLED' }),
  reactivate: (r) => send(r, { status: 'PENDING' }, { paymentStatus: 'PENDING' }),
  /** Novo vencimento; uma cobrança atrasada volta a pendente se o novo prazo ainda não passou. */
  changeDueDate: (r, dueDate) => send(r, { dueDate, status: 'PENDING' }, { dueDate, paymentStatus: 'PENDING' }),
  payBatch: (items, { paidAt, method } = {}) =>
    api.post('/finance/receivables/pay', {
      items: items.map((i) => ({ source: i.source, id: i.id })),
      paidAt: paidAt || null,
      method: method || null,
    }),
};
