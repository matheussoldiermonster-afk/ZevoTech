const { z } = require('zod');
const prisma = require('../prismaClient');
const { parsePagination, paginate } = require('../lib/pagination');
const v = require('../lib/validators');
const { calculateTotal, periodFromTime, statusSideEffects } = require('../lib/serviceOrderRules');
const { todayCivil, parseDateOnly, addDays } = require('../lib/dates');
const { resolveLocation } = require('../services/locationService');
const { resolveEquipmentLinks, applyServiceOrderStock } = require('../services/equipmentService');
const { effectiveStatus, effectiveStatusWhere } = require('../services/financeService');
const { notFound, badRequest } = require('../lib/httpError');

const itemSchema = z.object({
  description: v.requiredText(1, 300),
  quantity: z.coerce.number().int().positive().max(100000).default(1),
  unitValue: v.money(),
});

const scheduleInput = z.object({
  date: v.dateOnly(),
  time: v.time(),
  period: v.schedulePeriod.nullable().optional(),
  technicianId: v.nullableUuid(),
});

const serviceOrderSchema = z.object({
  clientId: v.uuid().optional(),
  companyId: v.nullableUuid(),
  addressId: v.nullableUuid(),
  technicianId: v.nullableUuid(),
  title: v.requiredText(2, 200),
  description: v.nullableText(5000),
  type: v.serviceOrderType,
  priority: v.serviceOrderPriority.optional(),
  status: v.serviceOrderStatus.optional(),
  dueDate: v.nullableDateOnly(),
  items: z.array(itemSchema).max(200).default([]),
  // Equipamentos com quantidade: [{ equipmentId, quantity }]
  equipments: z
    .array(
      z.object({
        equipmentId: v.uuid(),
        quantity: z.coerce.number().int().min(1, 'A quantidade deve ser maior que zero.').max(100000).default(1),
      })
    )
    .max(100)
    .optional(),
  // LEGADO: lista de ids (1 unidade cada)
  equipmentIds: z.array(v.uuid()).max(100).optional(),
  // Novo formato de agendamento
  schedule: scheduleInput.optional(),
  // LEGADO (telas antigas): convertido em registro de agenda
  scheduledDate: v.nullableDateOnly(),
  period: v.schedulePeriod.nullable().optional(),
});

const paymentUpdateSchema = z.object({
  paymentStatus: v.paymentStatus,
  paymentMethod: v.paymentMethod.nullable().optional(),
  paidAt: v.nullableDateOnly(),
  dueDate: v.nullableDateOnly(),
});

const LIST_INCLUDE = {
  client: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  address: { select: { id: true, label: true, street: true, number: true, district: true, city: true, state: true } },
  technician: { select: { id: true, name: true } },
  schedules: { orderBy: [{ date: 'asc' }, { time: 'asc' }], take: 1 },
  _count: { select: { equipments: true } },
};

const SORT_MAP = {
  orderNumber: (o) => ({ orderNumber: o }),
  createdAt: (o) => ({ createdAt: o }),
  title: (o) => ({ title: o }),
  status: (o) => ({ status: o }),
  priority: (o) => ({ priority: o }),
  totalValue: (o) => ({ totalValue: o }),
  dueDate: (o) => ({ dueDate: { sort: o, nulls: 'last' } }),
  client: (o) => ({ client: { name: o } }),
};

function withEffectivePayment(order) {
  if (!order) return order;
  return { ...order, paymentStatus: effectiveStatus(order.paymentStatus, order.dueDate) };
}

function buildWhere(query, search) {
  const and = [];
  const status = v.enumListFilter(v.serviceOrderStatus, query.status);
  const type = v.enumListFilter(v.serviceOrderType, query.type);
  const priority = v.enumListFilter(v.serviceOrderPriority, query.priority);
  const paymentStatus = v.enumFilter(v.paymentStatus, query.paymentStatus);

  if (status) and.push({ status: { in: status } });
  if (type) and.push({ type: { in: type } });
  if (priority) and.push({ priority: { in: priority } });
  if (paymentStatus) {
    and.push(effectiveStatusWhere(paymentStatus, { statusField: 'paymentStatus', dueField: 'dueDate' }));
    and.push({ totalValue: { gt: 0 } });
  }
  for (const field of ['clientId', 'companyId', 'addressId', 'technicianId']) {
    if (query[field]) and.push({ [field]: v.uuidFilter(query[field]) });
  }
  // Período de abertura (datas civis inclusivas)
  const from = parseDateOnly(query.from);
  const to = parseDateOnly(query.to);
  if (from) and.push({ createdAt: { gte: from } });
  if (to) and.push({ createdAt: { lt: addDays(to, 1) } });

  if (search) {
    const contains = { contains: search, mode: 'insensitive' };
    const number = Number(search.replace(/^#/, ''));
    const or = [
      { title: contains },
      { client: { name: contains } },
      { company: { name: contains } },
      { technician: { name: contains } },
      { address: { OR: [{ street: contains }, { district: contains }, { city: contains }, { label: contains }] } },
    ];
    if (Number.isInteger(number) && number > 0 && number < 2147483647) or.push({ orderNumber: number });
    and.push({ OR: or });
  }
  return and.length ? { AND: and } : {};
}

async function list(req, res, next) {
  try {
    const p = parsePagination(req.query, { sortMap: SORT_MAP, defaultSort: 'createdAt', defaultOrder: 'desc' });
    const result = await paginate(
      prisma,
      prisma.serviceOrder,
      { where: buildWhere(req.query, p.search), include: LIST_INCLUDE },
      p
    );
    if (Array.isArray(result)) return res.json(result.map(withEffectivePayment));
    return res.json({ ...result, data: result.data.map(withEffectivePayment) });
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        company: true,
        address: true,
        technician: true,
        items: true,
        schedules: {
          orderBy: [{ date: 'asc' }, { time: 'asc' }],
          include: { technician: { select: { id: true, name: true } } },
        },
        equipments: {
          include: { equipment: { include: { equipmentType: { select: { id: true, name: true, category: true } } } } },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!order) throw notFound('Ordem de serviço não encontrada.');
    return res.json(withEffectivePayment(order));
  } catch (err) {
    return next(err);
  }
}

async function history(req, res, next) {
  try {
    const entries = await prisma.serviceOrderHistory.findMany({
      where: { serviceOrderId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    });
    return res.json(entries);
  } catch (err) {
    return next(err);
  }
}

async function assertTechnicianActive(tx, technicianId) {
  if (!technicianId) return;
  const t = await tx.technician.findUnique({ where: { id: technicianId }, select: { active: true } });
  if (!t) throw badRequest('Técnico não encontrado.');
  if (!t.active) throw badRequest('O técnico selecionado está inativo.');
}

/** Equipamentos informados no formato novo ({ equipmentId, quantity }) ou legado (ids). */
function equipmentItems(data) {
  if (data.equipments) return data.equipments;
  if (data.equipmentIds) return data.equipmentIds.map((equipmentId) => ({ equipmentId, quantity: 1 }));
  return undefined;
}

/*
 * Efeito no estoque (ver equipmentService.applyServiceOrderStock):
 *  - equipamento do ESTOQUE: as unidades saem do estoque ao CONCLUIR a OS
 *    e ficam instaladas no endereço;
 *  - RETIRADA DE KIT: as unidades do endereço voltam ao estoque ao concluir;
 *  - reabrir/cancelar uma OS concluída devolve o efeito (estorno).
 */

async function create(req, res, next) {
  try {
    const data = serviceOrderSchema.parse(req.body);
    const userId = req.user?.sub || null;

    const order = await prisma.$transaction(async (tx) => {
      const location = await resolveLocation(tx, data);
      await assertTechnicianActive(tx, data.technicianId);
      const links = await resolveEquipmentLinks(tx, equipmentItems(data), { type: data.type, addressId: location.addressId });
      const totalValue = calculateTotal(data.items);
      const status = data.status || 'OPEN';

      const created = await tx.serviceOrder.create({
        data: {
          clientId: location.clientId,
          companyId: location.companyId,
          addressId: location.addressId,
          technicianId: data.technicianId || null,
          title: data.title,
          description: data.description || null,
          type: data.type,
          priority: data.priority || 'NORMAL',
          status,
          totalValue,
          dueDate: data.dueDate || (status === 'COMPLETED' && totalValue > 0 ? todayCivil() : null),
          completedAt: status === 'COMPLETED' ? new Date() : null,
          items: { create: data.items },
          equipments: { create: links },
          history: { create: { action: 'CREATED', toStatus: status, userId } },
        },
      });

      // Agenda: novo formato (schedule) ou legado (scheduledDate/period)
      const sched = data.schedule || (data.scheduledDate ? { date: data.scheduledDate, period: data.period } : null);
      if (sched) {
        const technicianId = sched.technicianId || data.technicianId || null;
        await assertTechnicianActive(tx, technicianId);
        await tx.schedule.create({
          data: {
            serviceOrderId: created.id,
            date: sched.date,
            time: sched.time || null,
            period: sched.period || periodFromTime(sched.time) || null,
            technicianId,
          },
        });
      }

      if (status === 'COMPLETED') await applyServiceOrderStock(tx, created, 'apply', { userId });

      return tx.serviceOrder.findUnique({ where: { id: created.id }, include: { ...LIST_INCLUDE, items: true } });
    });

    return res.status(201).json(withEffectivePayment(order));
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = serviceOrderSchema.partial().parse(req.body);
    const userId = req.user?.sub || null;

    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.serviceOrder.findUnique({ where: { id: req.params.id } });
      if (!current) throw notFound('Ordem de serviço não encontrada.');
      if (current.status === 'CANCELLED' && data.status !== 'OPEN') {
        throw badRequest('Esta OS está cancelada. Reabra a OS (status "Aberta") para editá-la.');
      }

      const updateData = {};
      const historyEntries = [];

      // Local (cliente/empresa/endereço)
      const locationChanged =
        (data.clientId && data.clientId !== current.clientId) ||
        (data.companyId && data.companyId !== current.companyId) ||
        (data.addressId && data.addressId !== current.addressId);
      if (locationChanged) {
        const clientChanged = data.clientId && data.clientId !== current.clientId;
        const location = await resolveLocation(tx, {
          clientId: data.clientId || (data.companyId ? undefined : current.clientId),
          companyId: data.companyId || (clientChanged ? null : current.companyId),
          addressId: data.addressId || null,
        });
        Object.assign(updateData, location);
        historyEntries.push({ action: 'LOCATION_CHANGED' });
      }

      for (const field of ['title', 'description', 'type', 'priority', 'dueDate']) {
        if (data[field] !== undefined) updateData[field] = data[field];
      }
      if (data.technicianId !== undefined) {
        await assertTechnicianActive(tx, data.technicianId);
        updateData.technicianId = data.technicianId;
      }

      // Itens: substituição completa DENTRO da transação (antes podia perder itens)
      if (data.items) {
        updateData.totalValue = calculateTotal(data.items);
        await tx.serviceOrderItem.deleteMany({ where: { serviceOrderId: current.id } });
        updateData.items = { create: data.items };
      }

      // Equipamentos vinculados (revalidados se o local ou o tipo da OS mudou)
      const addressId = updateData.addressId || current.addressId;
      const orderType = updateData.type || current.type;
      const typeChanged = orderType !== current.type;
      const items = equipmentItems(data);
      const newStatus = data.status || current.status;

      if (items || locationChanged || typeChanged) {
        const appliedCount = await tx.serviceOrderEquipment.count({ where: { serviceOrderId: current.id, applied: true } });
        // Com o estoque já movimentado, mudar equipamentos/local/tipo exige reabrir a OS antes
        if (appliedCount > 0 && !(current.status === 'COMPLETED' && newStatus !== 'COMPLETED')) {
          throw badRequest('Os equipamentos desta OS já movimentaram o estoque. Reabra a OS para alterar equipamentos, local ou tipo.');
        }
      }

      // Reabrir/cancelar uma OS concluída: devolve o efeito no estoque ANTES das demais mudanças
      if (current.status === 'COMPLETED' && newStatus !== 'COMPLETED') {
        await applyServiceOrderStock(tx, current, 'revert', { userId });
      }

      if (items || locationChanged || typeChanged) {
        const existing = items
          ? null
          : await tx.serviceOrderEquipment.findMany({
              where: { serviceOrderId: current.id },
              select: { equipmentId: true, quantity: true },
            });
        const links = await resolveEquipmentLinks(tx, items || existing, { type: orderType, addressId });
        await tx.serviceOrderEquipment.deleteMany({ where: { serviceOrderId: current.id } });
        updateData.equipments = { create: links };
      }

      // Status
      if (newStatus !== current.status) {
        Object.assign(updateData, { status: newStatus }, statusSideEffects(current.status, newStatus));
        const total = updateData.totalValue !== undefined ? updateData.totalValue : Number(current.totalValue);
        if (newStatus === 'COMPLETED' && !current.dueDate && updateData.dueDate === undefined && total > 0) {
          updateData.dueDate = todayCivil();
        }
        historyEntries.push({ action: 'STATUS_CHANGED', fromStatus: current.status, toStatus: newStatus });
      }

      if (historyEntries.length === 0) historyEntries.push({ action: 'UPDATED' });
      updateData.history = { create: historyEntries.map((h) => ({ ...h, userId })) };

      const updated = await tx.serviceOrder.update({ where: { id: current.id }, data: updateData });

      if (newStatus === 'COMPLETED' && current.status !== 'COMPLETED') {
        await applyServiceOrderStock(tx, updated, 'apply', { userId });
      }

      return tx.serviceOrder.findUnique({ where: { id: current.id }, include: { ...LIST_INCLUDE, items: true } });
    });

    return res.json(withEffectivePayment(order));
  } catch (err) {
    return next(err);
  }
}

async function updatePayment(req, res, next) {
  try {
    const data = paymentUpdateSchema.parse(req.body);
    const userId = req.user?.sub || null;
    const current = await prisma.serviceOrder.findUnique({ where: { id: req.params.id } });
    if (!current) throw notFound('Ordem de serviço não encontrada.');
    if (Number(current.totalValue) <= 0) throw badRequest('Esta OS não tem valor a cobrar.');

    const paid = data.paymentStatus === 'PAID';
    let paidAt = null;
    if (paid) {
      // Data informada pelo usuário = dia civil; gravamos 12:00 de Brasília (15:00 UTC)
      // para que o instante nunca "vire o dia" na conversão de fuso.
      paidAt = data.paidAt ? new Date(data.paidAt.getTime() + 15 * 3600000) : current.paidAt || new Date();
    }
    let dueDate = current.dueDate;
    if (data.dueDate !== undefined) dueDate = data.dueDate;
    else if (!dueDate && !paid) dueDate = todayCivil();

    const order = await prisma.serviceOrder.update({
      where: { id: current.id },
      data: {
        paymentStatus: data.paymentStatus,
        paymentMethod: data.paymentMethod !== undefined ? data.paymentMethod : current.paymentMethod,
        paidAt,
        dueDate,
        history: {
          create: {
            action: 'PAYMENT_UPDATED',
            note: `Pagamento: ${current.paymentStatus} → ${data.paymentStatus}`,
            userId,
          },
        },
      },
    });
    return res.json(withEffectivePayment(order));
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const userId = req.user?.sub || null;
    await prisma.$transaction(async (tx) => {
      const current = await tx.serviceOrder.findUnique({ where: { id: req.params.id } });
      if (!current) throw notFound('Ordem de serviço não encontrada.');
      // Cancelar uma OS concluída devolve o efeito dos equipamentos no estoque
      if (current.status === 'COMPLETED') await applyServiceOrderStock(tx, current, 'revert', { userId });
      await tx.serviceOrder.update({
        where: { id: current.id },
        data: {
          status: 'CANCELLED',
          history: { create: { action: 'CANCELLED', fromStatus: current.status, toStatus: 'CANCELLED', userId } },
        },
      });
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getById, history, create, update, updatePayment, remove };
