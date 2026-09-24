const { z } = require('zod');
const prisma = require('../prismaClient');
const v = require('../lib/validators');
const { parseDateOnly, todayCivil, addDays } = require('../lib/dates');
const { periodFromTime } = require('../lib/serviceOrderRules');
const { badRequest, notFound } = require('../lib/httpError');

const MAX_RANGE_DAYS = 93;

const scheduleSchema = z.object({
  serviceOrderId: v.uuid(),
  date: v.dateOnly(),
  time: v.time(),
  period: v.schedulePeriod.nullable().optional(),
  technicianId: v.nullableUuid(),
});

const INCLUDE = {
  technician: { select: { id: true, name: true } },
  serviceOrder: {
    select: {
      id: true,
      orderNumber: true,
      title: true,
      type: true,
      priority: true,
      status: true,
      client: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      address: {
        select: { id: true, label: true, street: true, number: true, district: true, city: true, state: true },
      },
      technician: { select: { id: true, name: true } },
    },
  },
};

/**
 * GET /api/schedules
 *   ?date=YYYY-MM-DD                  (compatível com a versão anterior: um dia)
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD    (intervalo inclusivo, máx. 93 dias)
 *   &technicianId &clientId &companyId &addressId &serviceOrderId
 *   &status=OPEN,IN_PROGRESS (status da OS) &priority=HIGH,URGENT &type=...
 * Sem datas: hoje até +6 dias.
 */
async function list(req, res, next) {
  try {
    const q = req.query;
    let from;
    let to;
    if (q.date) {
      from = parseDateOnly(q.date);
      if (!from) throw badRequest('Data inválida. Use o formato AAAA-MM-DD.');
      to = from;
    } else if (q.serviceOrderId && !q.from && !q.to) {
      from = null; // agenda completa de uma OS
      to = null;
    } else {
      from = q.from ? parseDateOnly(q.from) : todayCivil();
      to = q.to ? parseDateOnly(q.to) : addDays(from || todayCivil(), 6);
      if (!from || !to) throw badRequest('Período inválido. Use o formato AAAA-MM-DD.');
      if (to < from) throw badRequest('A data final deve ser igual ou posterior à inicial.');
      if ((to.getTime() - from.getTime()) / 86400000 > MAX_RANGE_DAYS) {
        throw badRequest(`O período máximo da agenda é de ${MAX_RANGE_DAYS} dias.`);
      }
    }

    const orderWhere = {};
    const status = v.enumListFilter(v.serviceOrderStatus, q.status);
    const priority = v.enumListFilter(v.serviceOrderPriority, q.priority);
    const type = v.enumListFilter(v.serviceOrderType, q.type);
    if (status) orderWhere.status = { in: status };
    if (priority) orderWhere.priority = { in: priority };
    if (type) orderWhere.type = { in: type };
    if (q.clientId) orderWhere.clientId = v.uuidFilter(q.clientId);
    if (q.companyId) orderWhere.companyId = v.uuidFilter(q.companyId);
    if (q.addressId) orderWhere.addressId = v.uuidFilter(q.addressId);

    const where = {
      serviceOrderId: q.serviceOrderId ? v.uuidFilter(q.serviceOrderId) : undefined,
      date: from ? { gte: from, lt: addDays(to, 1) } : undefined,
      serviceOrder: Object.keys(orderWhere).length ? orderWhere : undefined,
    };
    if (q.technicianId) {
      // Técnico do agendamento ou, se vazio, o técnico da OS
      const tid = v.uuidFilter(q.technicianId);
      where.OR = [{ technicianId: tid }, { technicianId: null, serviceOrder: { technicianId: tid } }];
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ date: 'asc' }, { time: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: 2000,
    });

    return res.json(schedules);
  } catch (err) {
    return next(err);
  }
}

async function assertSchedulable(tx, serviceOrderId, technicianId) {
  const order = await tx.serviceOrder.findUnique({ where: { id: serviceOrderId }, select: { status: true } });
  if (!order) throw badRequest('Ordem de serviço não encontrada.');
  if (order.status === 'CANCELLED') throw badRequest('Não é possível agendar uma OS cancelada.');
  if (technicianId) {
    const t = await tx.technician.findUnique({ where: { id: technicianId }, select: { active: true } });
    if (!t) throw badRequest('Técnico não encontrado.');
    if (!t.active) throw badRequest('O técnico selecionado está inativo.');
  }
}

async function create(req, res, next) {
  try {
    const data = scheduleSchema.parse(req.body);
    await assertSchedulable(prisma, data.serviceOrderId, data.technicianId);
    const schedule = await prisma.schedule.create({
      data: {
        ...data,
        time: data.time || null,
        period: data.period || periodFromTime(data.time) || null,
        technicianId: data.technicianId || null,
      },
      include: INCLUDE,
    });
    return res.status(201).json(schedule);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = scheduleSchema.partial().parse(req.body);
    const current = await prisma.schedule.findUnique({ where: { id: req.params.id } });
    if (!current) throw notFound('Agendamento não encontrado.');
    await assertSchedulable(prisma, data.serviceOrderId || current.serviceOrderId, data.technicianId);
    if (data.time && data.period === undefined) data.period = periodFromTime(data.time);
    const schedule = await prisma.schedule.update({ where: { id: current.id }, data, include: INCLUDE });
    return res.json(schedule);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await prisma.schedule.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, create, update, remove };
