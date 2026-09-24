const { z } = require('zod');
const prisma = require('../prismaClient');
const { requiredText, nullableText } = require('../lib/validators');

const schema = z.object({
  name: requiredText(2, 120),
  category: requiredText(2, 80),
  model: nullableText(120),
  minimumStock: z.coerce.number().int().nonnegative().max(100000).optional(),
});

/** Tipos com a QUANTIDADE de unidades por situação (estoque, instalados, manutenção, danificados). */
async function list(req, res, next) {
  try {
    const [types, grouped] = await Promise.all([
      prisma.equipmentType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.equipment.groupBy({ by: ['equipmentTypeId', 'status'], _sum: { quantity: true } }),
    ]);

    const counts = new Map();
    for (const g of grouped) {
      const entry = counts.get(g.equipmentTypeId) || {};
      entry[g.status] = g._sum.quantity || 0;
      counts.set(g.equipmentTypeId, entry);
    }

    return res.json(
      types.map((t) => {
        const c = counts.get(t.id) || {};
        const inStock = c.IN_STOCK || 0;
        return {
          ...t,
          counts: {
            inStock,
            installed: c.INSTALLED || 0,
            maintenance: c.MAINTENANCE || 0,
            damaged: c.DAMAGED || 0,
            discarded: c.DISCARDED || 0,
          },
          belowMinimum: t.minimumStock > 0 && inStock < t.minimumStock,
          // compatibilidade com a resposta anterior
          _count: { equipments: Object.values(c).reduce((a, b) => a + b, 0) },
        };
      })
    );
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = schema.parse(req.body);
    return res.status(201).json(await prisma.equipmentType.create({ data }));
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = schema.partial().parse(req.body);
    return res.json(await prisma.equipmentType.update({ where: { id: req.params.id }, data }));
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await prisma.equipmentType.update({ where: { id: req.params.id }, data: { active: false } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, create, update, remove };
