const { z } = require('zod');
const prisma = require('../prismaClient');
const { parsePagination, paginate, parseBool } = require('../lib/pagination');
const { nullableText, requiredText, uuid, uuidFilter } = require('../lib/validators');
const { notFound, conflict, badRequest } = require('../lib/httpError');

const companySchema = z.object({
  clientId: uuid(),
  name: requiredText(2, 200),
  tradeName: nullableText(200),
  document: nullableText(20),
  email: z.preprocess((v) => (v === '' ? null : v), z.string().email().nullable().optional()),
  phone: nullableText(30),
  notes: nullableText(2000),
  active: z.boolean().optional(),
  // Endereço principal opcional criado junto com a empresa
  mainAddress: z
    .object({
      label: nullableText(60),
      street: nullableText(200),
      number: nullableText(20),
      complement: nullableText(100),
      district: nullableText(100),
      city: nullableText(100),
      state: nullableText(2),
      zipCode: nullableText(10),
      reference: nullableText(200),
    })
    .optional(),
});

const SORT_MAP = {
  name: (o) => ({ name: o }),
  createdAt: (o) => ({ createdAt: o }),
  client: (o) => ({ client: { name: o } }),
};

async function list(req, res, next) {
  try {
    const p = parsePagination(req.query, { sortMap: SORT_MAP, defaultSort: 'name' });
    const active = parseBool(req.query.active);
    const contains = p.search ? { contains: p.search, mode: 'insensitive' } : undefined;

    const where = {
      clientId: uuidFilter(req.query.clientId),
      active: active !== undefined ? active : true,
      OR: contains
        ? [
            { name: contains },
            { tradeName: contains },
            { document: { contains: p.search } },
            { client: { name: contains } },
          ]
        : undefined,
    };

    const result = await paginate(
      prisma,
      prisma.company,
      {
        where,
        include: {
          client: { select: { id: true, name: true } },
          addresses: {
            where: { active: true },
            orderBy: [{ isMain: 'desc' }, { label: 'asc' }],
          },
          _count: { select: { serviceOrders: true, contracts: true } },
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
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: { id: true, name: true } },
        addresses: {
          orderBy: [{ isMain: 'desc' }, { label: 'asc' }],
          include: { _count: { select: { equipments: true, serviceOrders: true } } },
        },
        _count: { select: { serviceOrders: true, contracts: true } },
      },
    });
    if (!company) throw notFound('Empresa não encontrada.');
    return res.json(company);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const { mainAddress, ...data } = companySchema.parse(req.body);
    const client = await prisma.client.findUnique({ where: { id: data.clientId }, select: { active: true } });
    if (!client) throw badRequest('Cliente não encontrado.');
    if (!client.active) throw badRequest('Não é possível adicionar empresa a um cliente inativo.');

    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({ data });
      if (mainAddress) {
        await tx.address.create({
          data: { ...mainAddress, label: mainAddress.label || 'Principal', companyId: created.id, isMain: true },
        });
      }
      return tx.company.findUnique({ where: { id: created.id }, include: { addresses: true } });
    });
    return res.status(201).json(company);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = companySchema.partial().omit({ mainAddress: true }).parse(req.body);
    if (data.clientId) {
      const current = await prisma.company.findUnique({ where: { id: req.params.id }, select: { clientId: true } });
      if (current && current.clientId !== data.clientId) {
        throw badRequest('Não é possível mover a empresa para outro cliente.');
      }
    }
    const company = await prisma.company.update({ where: { id: req.params.id }, data });
    return res.json(company);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const activeContracts = await prisma.contract.count({
      where: { companyId: req.params.id, status: 'ACTIVE' },
    });
    if (activeContracts > 0) {
      throw conflict('Esta empresa tem contratos ativos. Encerre os contratos antes de desativá-la.');
    }
    await prisma.company.update({ where: { id: req.params.id }, data: { active: false } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getById, create, update, remove };
