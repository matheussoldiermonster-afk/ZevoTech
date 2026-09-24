const test = require('node:test');
const assert = require('node:assert/strict');
const { movementTypeFor, normalizeEquipmentState } = require('../src/lib/equipmentRules');

test('sem mudança não gera movimentação', () => {
  assert.equal(movementTypeFor({ status: 'IN_STOCK', addressId: null }, { status: 'IN_STOCK', addressId: null }), null);
});

test('tipos de movimentação por mudança de status/endereço', () => {
  const stock = { status: 'IN_STOCK', addressId: null };
  const installedA = { status: 'INSTALLED', addressId: 'A' };
  assert.equal(movementTypeFor(stock, installedA), 'INSTALL');
  assert.equal(movementTypeFor(installedA, stock), 'REMOVE');
  assert.equal(movementTypeFor(installedA, { status: 'INSTALLED', addressId: 'B' }), 'TRANSFER');
  assert.equal(movementTypeFor(installedA, { status: 'MAINTENANCE', addressId: 'A' }), 'TO_MAINTENANCE');
  assert.equal(movementTypeFor({ status: 'MAINTENANCE', addressId: 'A' }, installedA), 'FROM_MAINTENANCE');
  assert.equal(movementTypeFor({ status: 'MAINTENANCE', addressId: null }, installedA), 'INSTALL');
  assert.equal(movementTypeFor(installedA, { status: 'DAMAGED', addressId: 'A' }), 'DAMAGED');
  assert.equal(movementTypeFor(stock, { status: 'DISCARDED', addressId: null }), 'DISCARD');
});

test('equipamento em estoque não fica vinculado a endereço', () => {
  assert.deepEqual(normalizeEquipmentState({ status: 'IN_STOCK', addressId: 'A' }), { status: 'IN_STOCK', addressId: null });
  assert.deepEqual(normalizeEquipmentState({ status: 'DAMAGED', addressId: 'A' }), { status: 'DAMAGED', addressId: 'A' });
});
