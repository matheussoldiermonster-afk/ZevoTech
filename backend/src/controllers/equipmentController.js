const { z } = require('zod');
const prisma = require('../prismaClient');
const { parsePagination, paginate, parseBool } = require('../lib/pagination');
const v = require('../lib/validators');
const { createEquipment, moveUnits, adjustStock, findLot } = require('../services/equipmentService');
const { resolveLocation } = require('../services/locationService');
const { notFound, conflict, badRequest } = require('../lib/httpError');

const schema = z.object({
  equipmentTypeId: v.uuid(),
  addressId: v.nullableUuid(),
  clientId: v.nullableUuid(), // LEGADO: resolvido para o endereço do cliente
  serialNumber: v.nullableText(100), // '' → null (antes causava conflito de único)
  status: v.equipmentStatus.optional(),
  installationDate: v.nullableDateOnly(),
  location: v.nullableText(200),
  notes: v.nullableText(2000),
  movementNotes: v.nullableText(500), // observação da movimentação (não é gravada no equipamento)
  // Controle por quantidade: na criação = unidades que entram; nas ações = unidades movimentadas
  quantity: z.coerce.number().int().min(1, 'A quantidade deve ser maior que zero.').max(1000000).optional(),
});

const adjustSchema = z.object({
  // positivo = entrada no estoque; negativo = saída
  delta: z.coerce.number().int().refine((d) => d !== 0, 'Informe uma quantidade diferente de zero.'),
  notes: v.nullableText(500),
});

const INCLUDE = {
  equipmentType: { select: { id: true, name: true, category: true, model: true } },
  client: { select: { id: true, name: true } },
  address: {
    select: {
      id: true,
      label: true,
      street: true,
      number: true,
      district: true,
      city: true,
      company: { select: { id: true, name: true } },
    },
  },
};

const SORT_MAP = {
  createdAt: (o) => ({ createdAt: o }),
  serialNumber: (o) => ({ serialNumber: { sort: o, nulls: 'last' } }),
  quantity: (o) => ({ quantity: o }),
  status: (o) => ({ status: o }),
  type: (o) => ({ equipmentType: { name: o } }),
  client: (o) => ({ client: { name: o } }),
};

/** Compatibilidade: tela antiga envia só clientId → usa o endereço do cliente (se único/principal). */
async function legacyAddressFromClient(tx, clientId) {
  if (!clientId) return null;
  const loc = await resolveLocation(tx, { clientId });
  return loc.addressId;
}

async function list(req, res, next) {
  try {
    const p = parsePagination(req.query, { sortMap: SORT_MAP, defaultSort: 'createdAt', defaultOrder: 'desc' });
    const q = req.query;
    const and = [];
    const status = v.enumListFilter(v.equipmentStatus, q.status);
    // Descartados só aparecem quando pedidos explicitamente
    if (status) and.push({ status: { in: status } });
    else if (!parseBool(q.includeDiscarded)) and.push({ status: { not: 'DISCARDED' } });
    // Registros que ficaram sem unidades somem da lista; o de estoque continua
    // aparecendo (com 0) para mostrar que o item existe mas está esgotado.
    and.push({ OR: [{ quantity: { gt: 0 } }, { status: 'IN_STOCK' }] });
    if (q.equipmentTypeId) and.push({ equipmentTypeId: v.uuidFilter(q.equipmentTypeId) });
    if (q.clientId) and.push({ clientId: v.uuidFilter(q.clientId) });
    if (q.addressId) and.push({ addressId: v.uuidFilter(q.addressId) });
    if (q.companyId) and.push({ address: { companyId: v.uuidFilter(q.companyId) } });
    if (parseBool(q.available)) and.push({ status: 'IN_STOCK' });
    if (p.search) {
      const contains = { contains: p.search, mode: 'insensitive' };
      and.push({
        OR: [
          { serialNumber: contains },
          { equipmentType: { name: contains } },
          { client: { name: contains } },
          { address: { OR: [{ street: contains }, { city: contains }, { company: { name: contains } }] } },
        ],
      });
    }

    const result = await paginate(
      prisma,
      prisma.equipment,
      { where: and.length ? { AND: and } : {}, include: INCLUDE },
      p
    );
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id }, include: INCLUDE });
    if (!equipment) throw notFound('Equipamento não encontrado.');
    return res.json(equipment);
  } catch (err) {
    return next(err);
  }
}

async function movements(req, res, next) {
  try {
    const list = await prisma.equipmentMovement.findMany({
      where: { equipmentId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        fromAddress: { select: { id: true, label: true, street: true, city: true, company: { select: { name: true } } } },
        toAddress: { select: { id: true, label: true, street: true, city: true, company: { select: { name: true } } } },
        serviceOrder: { select: { id: true, orderNumber: true } },
        user: { select: { id: true, name: true } },
      },
    });
    return res.json(list);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const { clientId, movementNotes, ...data } = schema.parse(req.body);
    const equipment = await prisma.$transaction(async (tx) => {
      if (!data.addressId && clientId) data.addressId = await legacyAddressFromClient(tx, clientId);
      const created = await createEquipment(tx, data, { userId: req.user?.sub, notes: movementNotes });
      return tx.equipment.findUnique({ where: { id: created.id }, include: INCLUDE });
    });
    return res.status(201).json(equipment);
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /equipments/:id
 *  - dados cadastrais (tipo, nº de série, observações, data de instalação): alteram o registro;
 *  - status/endereço: movimentam `quantity` unidades (padrão: todas do registro).
 * Retorna o registro de destino (pode ser outro, quando as unidades vão para um lote existente).
 */
async function update(req, res, next) {
  try {
    const { clientId, movementNotes, quantity, status, addressId: rawAddressId, ...fields } = schema.partial().parse(req.body);
    let addressId = rawAddressId;
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.equipment.findUnique({ where: { id: req.params.id } });
      if (!current) throw notFound('Equipamento não encontrado.');
      if (addressId === undefined && clientId) addressId = await legacyAddressFromClient(tx, clientId);
      if (addressId === undefined && clientId === null) addressId = null;

      if (fields.equipmentTypeId && fields.equipmentTypeId !== current.equipmentTypeId) {
        const other = await findLot(tx, fields.equipmentTypeId, current.status, current.addressId);
        if (other) {
          throw conflict('Já existe um registro desse equipamento nesta situação/local. Use as ações de entrada ou transferência.');
        }
      }
      const cadastral = Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== undefined));
      if (Object.keys(cadastral).length) {
        await tx.equipment.update({ where: { id: current.id }, data: cadastral });
      }

      const moves = status !== undefined || addressId !== undefined;
      if (!moves) return current.id;
      const dest = await moveUnits(
        tx,
        current.id,
        { status, addressId, quantity },
        { userId: req.user?.sub, notes: movementNotes }
      );
      return dest.id;
    });
    const equipment = await prisma.equipment.findUnique({ where: { id: result }, include: INCLUDE });
    return res.json(equipment);
  } catch (err) {
    return next(err);
  }
}

/** POST /equipments/:id/adjust { delta, notes } — entrada (+) ou saída (−) do estoque. */
async function adjust(req, res, next) {
  try {
    const data = adjustSchema.parse(req.body);
    await prisma.$transaction((tx) => adjustStock(tx, req.params.id, data.delta, { userId: req.user?.sub, notes: data.notes }));
    const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id }, include: INCLUDE });
    return res.json(equipment);
  } catch (err) {
    return next(err);
  }
}

/** DELETE /equipments/:id?quantity=N — descarta N unidades (padrão: todas do registro). */
async function remove(req, res, next) {
  try {
    let quantity;
    if (req.query.quantity !== undefined) {
      quantity = Number(req.query.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) throw badRequest('Quantidade inválida.');
    }
    await prisma.$transaction((tx) =>
      moveUnits(tx, req.params.id, { status: 'DISCARDED', addressId: null, quantity }, { userId: req.user?.sub })
    );
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getById, movements, create, update, adjust, remove };
