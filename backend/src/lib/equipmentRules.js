/** Regras puras de movimentação de equipamentos (testadas em test/equipmentRules.test.js). */

/**
 * Deduz o tipo de movimentação a partir da mudança de status/endereço.
 * @returns {string|null} tipo de EquipmentMovement, ou null se nada mudou.
 */
function movementTypeFor(before, after) {
  const statusChanged = before.status !== after.status;
  const addressChanged = (before.addressId || null) !== (after.addressId || null);
  if (!statusChanged && !addressChanged) return null;

  if (statusChanged) {
    if (after.status === 'DISCARDED') return 'DISCARD';
    if (after.status === 'DAMAGED') return 'DAMAGED';
    if (after.status === 'MAINTENANCE') return 'TO_MAINTENANCE';
    if (before.status === 'MAINTENANCE') return after.status === 'INSTALLED' && addressChanged ? 'INSTALL' : 'FROM_MAINTENANCE';
    if (after.status === 'INSTALLED') return 'INSTALL';
    if (after.status === 'IN_STOCK') return 'REMOVE';
    return 'STATUS_CHANGE';
  }
  // Só o endereço mudou
  if (!before.addressId && after.addressId) return 'INSTALL';
  if (before.addressId && !after.addressId) return 'REMOVE';
  return 'TRANSFER';
}

/**
 * Normaliza o estado final de um equipamento conforme o status.
 * Em estoque o equipamento não fica em nenhum endereço/cliente.
 */
function normalizeEquipmentState(state) {
  const next = { ...state };
  if (next.status === 'IN_STOCK') {
    next.addressId = null;
  }
  return next;
}

module.exports = { movementTypeFor, normalizeEquipmentState };
