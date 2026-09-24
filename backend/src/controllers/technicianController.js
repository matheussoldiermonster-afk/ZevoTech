const { z } = require('zod');
const prisma = require('../prismaClient');
const { parsePagination, paginate, parseBool } = require('../lib/pagination');
const { nullableText, requiredText } = require('../lib/validators');

const technicianSchema = z.object({
  name: requiredText(2, 120),
  phone: nullableText(30),
  email: z.preprocess((v) => (v === '' ? null : v), z.string().email().nullable().optional()),
  active: z.boolean().optional(),
});

const SORT_MAP = { name: (o) => ({ name: o }) };

async function list(req, res, next) {
  try {
    const p = parsePagination(req.query, { sortMap: SORT_MAP, defaultSort: 'name' });
    const active = parseBool(req.query.active);
    const where = {
      // ?active=all lista também os inativos (tela de gerenciamento)
      active: req.query.active === 'all' ? undefined : active !== undefined ? active : true,
      name: p.search ? { contains: p.search, mode: 'insensitive' } : undefined,
    };
    return res.json(await paginate(prisma, prisma.technician, { where }, p));
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = technicianSchema.parse(req.body);
    return res.status(201).json(await prisma.technician.create({ data }));
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = technicianSchema.partial().parse(req.body);
    return res.json(await prisma.technician.update({ where: { id: req.params.id }, data }));
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await prisma.technician.update({ where: { id: req.params.id }, data: { active: false } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, create, update, remove };
