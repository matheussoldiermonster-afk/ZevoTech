/**
 * Equipamentos com controle por QUANTIDADE.
 *
 * Cada registro é um "lote": N unidades do mesmo tipo, na mesma situação e no
 * mesmo local. O estoque de cada tipo é um único registro (IN_STOCK, sem
 * endereço) cuja quantidade é o número de unidades disponíveis.
 *
 * Toda alteração de quantidade/local/situação passa por aqui, para que:
 *  - a quantidade nunca fique negativa (baixa atômica + CHECK no banco);
 *  - clientId fique sincronizado com o endereço;
 *  - toda mudança gere uma movimentação com a quantidade movida (histórico).
 */
const { movementTypeFor, normalizeEquipmentState } = require('../lib/equipmentRules');
const { ownerOfAddress } = require('./locationService');
const { badRequest, notFound, conflict } = require('../lib/httpError');
const { todayCivil } = require('../lib/dates');

const STATUS_LABEL = { IN_STOCK: 'Em estoque', INSTALLED: 'Instalado', MAINTENANCE: 'Em manutenção', DAMAGED: 'Danificado', DISCARDED: 'Descartado' };

function assertQuantity(q, label = 'A quantidade') {
  if (!Number.isInteger(q) || q < 1) throw badRequest(`${label} deve ser um número inteiro maior que zero.`);
}

/** Registro (lote) de um tipo em uma situação/local, se existir. */
function findLot(tx, equipmentTypeId, status, addressId) {
  return tx.equipment.findFirst({
    where: { equipmentTypeId, status, addressId: addressId || null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

async function typeName(tx, equipmentTypeId) {
  const t = await tx.equipmentType.findUnique({ where: { id: equipmentTypeId }, select: { name: true } });
  return t?.name || 'equipamento';
}

/**
 * Soma unidades a um lote (cria o lote se ainda não existir).
 * Um lote que tinha nº de série individual passa a representar várias
 * unidades: o nº de série vai para as observações.
 */
async function addToLot(tx, { equipmentTypeId, status, addressId, quantity, installationDate }) {
  const lot = await findLot(tx, equipmentTypeId, status, addressId);
  if (lot) {
    const data = { quantity: { increment: quantity } };
    if (lot.serialNumber) {
      data.serialNumber = null;
      data.notes = [lot.notes, `Nº de série da unidade original: ${lot.serialNumber}`].filter(Boolean).join('\n');
    }
    if (status === 'INSTALLED' && !lot.installationDate) data.installationDate = installationDate || todayCivil();
    return tx.equipment.update({ where: { id: lot.id }, data });
  }
  const clientId = addressId ? (await ownerOfAddress(tx, addressId)).clientId : null;
  return tx.equipment.create({
    data: {
      equipmentTypeId,
      status,
      addressId: addressId || null,
      clientId,
      quantity,
      installationDate: status === 'INSTALLED' ? installationDate || todayCivil() : null,
    },
  });
}

/** Baixa atômica: só retira se houver quantidade suficiente. */
async function takeFrom(tx, equipment, quantity) {
  const res = await tx.equipment.updateMany({
    where: { id: equipment.id, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
  if (res.count === 0) {
    const current = await tx.equipment.findUnique({ where: { id: equipment.id }, select: { quantity: true } });
    throw badRequest(
      `Quantidade insuficiente de ${await typeName(tx, equipment.equipmentTypeId)}: disponível ${current?.quantity ?? 0}, solicitado ${quantity}.`
    );
  }
}

function movement(tx, equipmentId, data, ctx) {
  return tx.equipmentMovement.create({
    data: {
      equipmentId,
      userId: ctx.userId || null,
      serviceOrderId: ctx.serviceOrderId || null,
      notes: ctx.notes || null,
      ...data,
    },
  });
}

/**
 * Move `quantity` unidades de um registro para outra situação/local.
 * Ex.: 4 câmeras do estoque → instaladas no endereço X.
 * Se todas as unidades de um registro fora do estoque forem movidas e não
 * existir lote no destino, o próprio registro muda (mantém o histórico).
 * O registro de estoque nunca é removido (fica com quantidade 0).
 */
async function moveUnits(tx, equipmentId, { status, addressId, quantity }, ctx = {}) {
  const source = await tx.equipment.findUnique({ where: { id: equipmentId } });
  if (!source) throw notFound('Equipamento não encontrado.');

  const qty = quantity === undefined || quantity === null ? source.quantity : quantity;
  assertQuantity(qty);
  if (qty > source.quantity) {
    throw badRequest(`Este registro tem ${source.quantity} unidade(s); não é possível movimentar ${qty}.`);
  }

  const target = normalizeEquipmentState({
    status: status !== undefined ? status : source.status,
    addressId: addressId !== undefined ? addressId : source.addressId,
  });
  if (target.status === 'DISCARDED') target.addressId = null;
  if (target.status === 'INSTALLED' && !target.addressId) {
    throw badRequest('Informe o endereço onde o equipamento será instalado.');
  }
  if (target.status === source.status && (target.addressId || null) === (source.addressId || null)) {
    return source; // nada muda
  }

  const type = movementTypeFor(source, target);
  const moveData = {
    // mesmo horário nos registros de origem e destino (identifica a operação nos relatórios)
    createdAt: new Date(),
    type,
    quantity: qty,
    fromStatus: source.status,
    toStatus: target.status,
    fromAddressId: source.addressId,
    toAddressId: target.addressId,
  };

  const existingTarget = await findLot(tx, source.equipmentTypeId, target.status, target.addressId);
  const wholeRecord = qty === source.quantity && source.status !== 'IN_STOCK' && !existingTarget;

  if (wholeRecord) {
    // O registro inteiro muda de lugar/situação
    const clientId = target.addressId ? (await ownerOfAddress(tx, target.addressId)).clientId : null;
    const moved = await tx.equipment.update({
      where: { id: source.id },
      data: {
        status: target.status,
        addressId: target.addressId,
        clientId,
        installationDate:
          target.status === 'INSTALLED' ? source.installationDate || todayCivil() : source.installationDate,
      },
    });
    await movement(tx, source.id, moveData, ctx);
    return moved;
  }

  await takeFrom(tx, source, qty);
  const dest = await addToLot(tx, {
    equipmentTypeId: source.equipmentTypeId,
    status: target.status,
    addressId: target.addressId,
    quantity: qty,
  });
  await movement(tx, source.id, moveData, ctx);
  if (dest.id !== source.id) await movement(tx, dest.id, moveData, ctx);
  return dest;
}

/**
 * Entrada de equipamentos. Em estoque, soma ao registro existente do tipo
 * (não cria cadastro repetido). Também aceita entrada já instalada num endereço.
 */
async function createEquipment(tx, data, ctx = {}) {
  const quantity = data.quantity ?? 1;
  assertQuantity(quantity);
  const state = normalizeEquipmentState({ status: data.status || 'IN_STOCK', addressId: data.addressId || null });
  if (state.status === 'INSTALLED' && !state.addressId) {
    throw badRequest('Informe o endereço onde o equipamento está instalado.');
  }
  if (state.status === 'DISCARDED') throw badRequest('Não é possível cadastrar um equipamento já descartado.');

  const type = await tx.equipmentType.findUnique({ where: { id: data.equipmentTypeId }, select: { active: true } });
  if (!type || !type.active) throw badRequest('Tipo de equipamento não encontrado.');

  const lot = await addToLot(tx, {
    equipmentTypeId: data.equipmentTypeId,
    status: state.status,
    addressId: state.addressId,
    quantity,
    installationDate: data.installationDate,
  });
  if (data.notes && !lot.notes) {
    await tx.equipment.update({ where: { id: lot.id }, data: { notes: data.notes } });
  }
  await movement(
    tx,
    lot.id,
    {
      type: state.status === 'INSTALLED' ? 'INSTALL' : 'ENTRY',
      quantity,
      toStatus: state.status,
      toAddressId: state.addressId,
    },
    ctx
  );
  return tx.equipment.findUnique({ where: { id: lot.id } });
}

/**
 * Ajuste de estoque: entrada (+) ou saída (−) de unidades do registro de estoque.
 * Ex.: chegaram 10 câmeras (+10); 2 foram vendidas/perdidas (−2).
 */
async function adjustStock(tx, equipmentId, delta, ctx = {}) {
  if (!Number.isInteger(delta) || delta === 0) throw badRequest('Informe uma quantidade diferente de zero.');
  const eq = await tx.equipment.findUnique({ where: { id: equipmentId } });
  if (!eq) throw notFound('Equipamento não encontrado.');
  if (eq.status !== 'IN_STOCK') {
    throw badRequest('Entrada e saída só se aplicam ao estoque. Para equipamentos em clientes, use as ações de movimentação.');
  }
  if (delta > 0) {
    await tx.equipment.update({ where: { id: eq.id }, data: { quantity: { increment: delta } } });
  } else {
    await takeFrom(tx, eq, -delta);
  }
  await movement(
    tx,
    eq.id,
    { type: delta > 0 ? 'ENTRY' : 'EXIT', quantity: Math.abs(delta), fromStatus: 'IN_STOCK', toStatus: 'IN_STOCK' },
    ctx
  );
  return tx.equipment.findUnique({ where: { id: eq.id } });
}

/**
 * Vínculos de equipamentos com uma OS: valida e define o efeito no estoque.
 * items: [{ equipmentId, quantity }]
 *  - registro do ESTOQUE → CONSUME (as unidades saem do estoque ao concluir a OS)
 *  - registro NESTE ENDEREÇO em retirada de kit → RETURN (voltam ao estoque)
 *  - registro NESTE ENDEREÇO nos demais tipos → REFERENCE (sem efeito no estoque)
 */
async function resolveEquipmentLinks(tx, items, { type, addressId }) {
  if (!items || items.length === 0) return [];
  const seen = new Set();
  const links = [];
  for (const item of items) {
    if (seen.has(item.equipmentId)) throw badRequest('O mesmo equipamento foi informado mais de uma vez.');
    seen.add(item.equipmentId);
    const quantity = item.quantity ?? 1;
    assertQuantity(quantity, 'A quantidade do equipamento');

    const eq = await tx.equipment.findUnique({ where: { id: item.equipmentId }, include: { equipmentType: { select: { name: true } } } });
    if (!eq) throw badRequest('Um ou mais equipamentos não foram encontrados.');
    const name = eq.equipmentType?.name || 'equipamento';
    if (eq.status === 'DISCARDED') throw badRequest(`O equipamento ${name} está descartado.`);

    let action;
    if (eq.status === 'IN_STOCK' && !eq.addressId) {
      if (type === 'KIT_REMOVAL') {
        throw badRequest(`Na retirada de kit, selecione equipamentos instalados neste endereço (${name} está no estoque).`);
      }
      action = 'CONSUME';
      if (quantity > eq.quantity) {
        throw badRequest(`Estoque insuficiente de ${name}: disponível ${eq.quantity}, solicitado ${quantity}.`);
      }
    } else if (eq.addressId && eq.addressId === addressId) {
      if (type === 'KIT_REMOVAL' && eq.status !== 'INSTALLED') {
        throw badRequest(
          `Na retirada de kit, só equipamentos instalados voltam ao estoque (${name} está como "${STATUS_LABEL[eq.status] || eq.status}"). Use as ações da aba Equipamentos.`
        );
      }
      action = type === 'KIT_REMOVAL' ? 'RETURN' : 'REFERENCE';
      if (quantity > eq.quantity) {
        throw badRequest(`Há ${eq.quantity} unidade(s) de ${name} neste endereço; não é possível usar ${quantity}.`);
      }
    } else {
      throw badRequest(`O equipamento ${name} está vinculado a outro endereço.`);
    }
    links.push({ equipmentId: eq.id, quantity, action });
  }
  return links;
}

/**
 * Aplica (ou desfaz) o efeito dos equipamentos de uma OS no estoque.
 *  - apply: ao concluir a OS.
 *  - revert: ao reabrir/cancelar uma OS que estava concluída.
 * Cada vínculo guarda `applied`, então o efeito nunca é aplicado duas vezes.
 */
async function applyServiceOrderStock(tx, order, mode, ctx = {}) {
  const links = await tx.serviceOrderEquipment.findMany({
    where: { serviceOrderId: order.id, action: { in: ['CONSUME', 'RETURN'] }, applied: mode === 'revert' },
    include: { equipment: { select: { equipmentTypeId: true } } },
  });
  const note = mode === 'apply' ? `OS #${order.orderNumber} concluída` : `OS #${order.orderNumber} reaberta/cancelada (estorno)`;
  const moveCtx = { ...ctx, serviceOrderId: order.id, notes: note };

  for (const link of links) {
    const typeId = link.equipment.equipmentTypeId;
    // CONSUME aplicado ou RETURN estornado: estoque → endereço. Caso contrário: endereço → estoque.
    const toAddress = (link.action === 'CONSUME') === (mode === 'apply');
    const from = toAddress ? { status: 'IN_STOCK', addressId: null } : { status: 'INSTALLED', addressId: order.addressId };
    const to = toAddress ? { status: 'INSTALLED', addressId: order.addressId } : { status: 'IN_STOCK', addressId: null };

    const source = await findLot(tx, typeId, from.status, from.addressId);
    if (!source || source.quantity < link.quantity) {
      const name = await typeName(tx, typeId);
      const available = source?.quantity ?? 0;
      throw conflict(
        toAddress
          ? `Estoque insuficiente de ${name} para concluir a OS: disponível ${available}, necessário ${link.quantity}.`
          : `Há ${available} unidade(s) de ${name} instaladas neste endereço; a OS precisa de ${link.quantity}.`
      );
    }
    await moveUnits(tx, source.id, { ...to, quantity: link.quantity }, moveCtx);
    await tx.serviceOrderEquipment.update({
      where: { serviceOrderId_equipmentId: { serviceOrderId: link.serviceOrderId, equipmentId: link.equipmentId } },
      data: { applied: mode === 'apply' },
    });
  }
  return links.length;
}

module.exports = {
  createEquipment,
  moveUnits,
  adjustStock,
  resolveEquipmentLinks,
  applyServiceOrderStock,
  findLot,
};
