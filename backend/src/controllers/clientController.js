const { z } = require('zod');
const prisma = require('../prismaClient');
const { parsePagination, paginate, parseBool } = require('../lib/pagination');
const { nullableText, requiredText } = require('../lib/validators');
const { notFound } = require('../lib/httpError');

const addressInput = z.object({
  label: nullableText(60),
  street: nullableText(200),
  number: nullableText(20),
  complement: nullableText(100),
  district: nullableText(100),
  city: nullableText(100),
  state: nullableText(2),
  zipCode: nullableText(10),
  reference: nullableText(200),
});

const companyInput = z.object({
  name: requiredText(2, 200),
  tradeName: nullableText(200),
  document: nullableText(20),
  email: z.preprocess((v) => (v === '' ? null : v), z.string().email().nullable().optional()),
  phone: nullableText(30),
  notes: nullableText(2000),
  addresses: z.array(addressInput).max(50).optional(),
});

const clientSchema = z.object({
  name: requiredText(2, 200),
  document: requiredText(11, 20),
  documentType: z.enum(['CPF', 'CNPJ']).default('CNPJ'),
  email: z.preprocess((v) => (v === '' ? null : v), z.string().email().nullable().optional()),
  phone: requiredText(8, 30),
  // Campos LEGADOS de endereço (telas antigas)
  address: nullableText(200),
  city: nullableText(100),
  state: nullableText(2),
  zipCode: nullableText(10),
  notes: nullableText(2000),
  active: z.boolean().optional(), // permite reativar cliente
  // Novo: empresas (e endereços) criadas junto com o cliente
  companies: z.array(companyInput).max(50).optional(),
});

const SORT_MAP = {
  name: (o) => ({ name: o }),
  createdAt: (o) => ({ createdAt: o }),
  document: (o) => ({ document: o }),
};

function buildSearch(search) {
  if (!search) return undefined;
  const contains = { contains: search, mode: 'insensitive' };
  const digits = search.replace(/\D/g, '');
  const docConds = [{ document: { contains: search } }];
  if (digits && digits !== search) docConds.push({ document: { contains: digits } });
  return [
    { name: contains },
    { email: contains },
    ...docConds,
    { phone: { contains: search } },
    {
      companies: {
        some: {
          OR: [{ name: contains }, { tradeName: contains }, ...docConds],
        },
      },
    },
    {
      companies: {
        some: {
          addresses: {
            some: { OR: [{ street: contains }, { district: contains }, { city: contains }, { label: contains }] },
          },
        },
      },
    },
  ];
}

async function list(req, res, next) {
  try {
    const p = parsePagination(req.query, { sortMap: SORT_MAP, defaultSort: 'name' });
    const active = parseBool(req.query.active);
    const includeInactive = parseBool(req.query.includeInactive);

    const where = {
      // Correção: clientes "excluídos" (inativos) não aparecem mais por padrão.
      active: active !== undefined ? active : includeInactive ? undefined : true,
      OR: buildSearch(p.search),
    };

    const result = await paginate(
      prisma,
      prisma.client,
      {
        where,
        include: { _count: { select: { companies: true, serviceOrders: true, contracts: true } } },
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
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        companies: {
          orderBy: { name: 'asc' },
          include: {
            addresses: {
              orderBy: [{ isMain: 'desc' }, { label: 'asc' }],
              include: {
                _count: { select: { equipments: true, serviceOrders: true } },
                // Unidades instaladas/no endereço (cada registro pode ter várias)
                equipments: { where: { status: { not: 'DISCARDED' }, quantity: { gt: 0 } }, select: { quantity: true } },
              },
            },
          },
        },
        contracts: {
          orderBy: { createdAt: 'desc' },
          include: { monthlyPayments: { orderBy: { dueDate: 'desc' }, take: 12 } },
        },
        serviceOrders: { orderBy: { createdAt: 'desc' }, take: 50 },
        equipments: { include: { equipmentType: { select: { name: true } } } },
      },
    });

    if (!client) throw notFound('Cliente não encontrado.');
    return res.json(client);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const { companies, ...data } = clientSchema.parse(req.body);

    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({ data });

      if (companies) {
        // Fluxo novo: empresas informadas explicitamente (pode ser lista vazia).
        for (const { addresses, ...companyData } of companies) {
          const company = await tx.company.create({ data: { ...companyData, clientId: created.id } });
          for (const [i, addr] of (addresses || []).entries()) {
            await tx.address.create({
              data: { ...addr, label: addr.label || 'Principal', companyId: company.id, isMain: i === 0 },
            });
          }
        }
      } else {
        // COMPATIBILIDADE (telas antigas): cria 1 empresa + 1 endereço com os
        // dados do próprio cliente, igual à migração dos registros existentes.
        const company = await tx.company.create({
          data: {
            clientId: created.id,
            name: created.name,
            document: created.documentType === 'CNPJ' ? created.document : null,
            email: created.email,
            phone: created.phone,
          },
        });
        await tx.address.create({
          data: {
            companyId: company.id,
            label: 'Principal',
            street: data.address || null,
            city: data.city || null,
            state: data.state || null,
            zipCode: data.zipCode || null,
            isMain: true,
          },
        });
      }
      return created;
    });

    return res.status(201).json(client);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = clientSchema.partial().parse(req.body);
    delete data.companies; // empresas são mantidas em /api/companies
    const client = await prisma.client.update({ where: { id: req.params.id }, data });
    return res.json(client);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await prisma.client.update({ where: { id: req.params.id }, data: { active: false } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getById, create, update, remove };
