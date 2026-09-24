const { z } = require('zod');
const prisma = require('../prismaClient');
const { parsePagination, paginate, parseBool } = require('../lib/pagination');
const { nullableText, uuid, uuidFilter } = require('../lib/validators');
const { notFound, conflict, badRequest } = require('../lib/httpError');

const addressSchema = z.object({
  companyId: uuid(),
  label: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(1).max(60)).optional(),
  street: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(2, 'Informe o logradouro.').max(200)),
  number: nullableText(20),
  complement: nullableText(100),
  district: nullableText(100),
  city: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(2, 'Informe a cidade.').max(100)),
  state: nullableText(2),
  zipCode: nullableText(10),
  reference: nullableText(200),
  isMain: z.boolean().optional(),
  active: z.boolean().optional(),
});

// Na edição, street/city podem ser completados depois (endereços migrados podem estar vazios)
const updateSchema = addressSchema.partial().extend({
  street: nullableText(200),
  city: nullableText(100),
});

const SORT_MAP = {
  label: (o) => ({ label: o }),
  city: (o) => ({ city: o }),
  createdAt: (o) => ({ createdAt: o }),
};

async function list(req, res, next) {
  try {
    const p = parsePagination(req.query, { sortMap: SORT_MAP, defaultSort: 'label' });
    const active = parseBool(req.query.active);
    const contains = p.search ? { contains: p.search, mode: 'insensitive' } : undefined;

    const where = {
      companyId: uuidFilter(req.query.companyId),
      company: req.query.clientId ? { clientId: uuidFilter(req.query.clientId) } : undefined,
      active: active !== undefined ? active : true,
      OR: contains
        ? [{ label: contains }, { street: contains }, { district: contains }, { city: contains }, { zipCode: contains }]
        : undefined,
    };

    const result = await paginate(
      prisma,
      prisma.address,
      {
        where,
        orderBy: p.paginated ? undefined : [{ isMain: 'desc' }, { label: 'asc' }],
        include: {
          company: { select: { id: true, name: true, clientId: true } },
          _count: { select: { equipments: true, serviceOrders: true } },
        },
      },
      p
    );
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const address = await prisma.address.findUnique({
      where: { id: req.params.id },
      include: {
        company: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
        equipments: {
          where: { status: { not: 'DISCARDED' } },
          include: { equipmentType: { select: { id: true, name: true, category: true } } },
        },
      },
    });
    if (!address) throw notFound('Endereço não encontrado.');
    return res.json(address);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = addressSchema.parse(req.body);
    const company = await prisma.company.findUnique({ where: { id: data.companyId }, select: { active: true } });
    if (!company) throw badRequest('Empresa não encontrada.');
    if (!company.active) throw badRequest('Não é possível adicionar endereço a uma empresa inativa.');

    const address = await prisma.$transaction(async (tx) => {
      const existing = await tx.address.count({ where: { companyId: data.companyId, active: true } });
      const isMain = existing === 0 ? true : Boolean(data.isMain);
      if (isMain) {
        await tx.address.updateMany({ where: { companyId: data.companyId, isMain: true }, data: { isMain: false } });
      }
      return tx.address.create({ data: { ...data, label: data.label || 'Principal', isMain } });
    });
    return res.status(201).json(address);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = updateSchema.parse(req.body);
    const current = await prisma.address.findUnique({ where: { id: req.params.id } });
    if (!current) throw notFound('Endereço não encontrado.');
    if (data.companyId && data.companyId !== current.companyId) {
      throw badRequest('Não é possível mover o endereço para outra empresa.');
    }

    const address = await prisma.$transaction(async (tx) => {
      if (data.isMain === true) {
        await tx.address.updateMany({
          where: { companyId: current.companyId, isMain: true, id: { not: current.id } },
          data: { isMain: false },
        });
      }
      return tx.address.update({ where: { id: current.id }, data });
    });
    return res.json(address);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const [installed, openOrders] = await Promise.all([
      prisma.equipment.count({ where: { addressId: req.params.id, status: { in: ['INSTALLED', 'MAINTENANCE'] }, quantity: { gt: 0 } } }),
      prisma.serviceOrder.count({ where: { addressId: req.params.id, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ]);
    if (installed > 0) {
      throw conflict('Há equipamentos instalados neste endereço. Retire ou transfira os equipamentos antes.');
    }
    if (openOrders > 0) {
      throw conflict('Há ordens de serviço em aberto neste endereço. Conclua ou cancele as OS antes.');
    }
    await prisma.address.update({ where: { id: req.params.id }, data: { active: false, isMain: false } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getById, create, update, remove };
