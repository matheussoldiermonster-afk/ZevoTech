const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../prismaClient');
const { badRequest, conflict, notFound } = require('../lib/httpError');
const { clearUserCache } = require('../middleware/auth');

const SELECT = { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true };

const password = z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(100);
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password,
  role: z.enum(['ADMIN', 'FINANCIAL']).default('FINANCIAL'),
});
const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['ADMIN', 'FINANCIAL']).optional(),
  active: z.boolean().optional(),
});

async function list(req, res, next) {
  try {
    const users = await prisma.user.findMany({ select: SELECT, orderBy: [{ active: 'desc' }, { name: 'asc' }] });
    return res.json(users);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = createSchema.parse(req.body);
    const existing = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: 'insensitive' } } });
    if (existing) throw conflict('Já existe um usuário com esse e-mail.');
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, role: data.role, passwordHash: await bcrypt.hash(data.password, 10) },
      select: SELECT,
    });
    return res.status(201).json(user);
  } catch (err) {
    return next(err);
  }
}

/**
 * Regras de proteção:
 *  - ninguém rebaixa nem desativa a si mesmo (evita perder o acesso por engano);
 *  - o sistema nunca fica sem ao menos um administrador ativo.
 */
async function update(req, res, next) {
  try {
    const data = updateSchema.parse(req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: SELECT });
    if (!target) throw notFound('Usuário não encontrado.');

    const isSelf = target.id === req.user.sub;
    if (isSelf && data.active === false) throw badRequest('Você não pode desativar o próprio usuário.');
    if (isSelf && data.role && data.role !== target.role) throw badRequest('Você não pode alterar o próprio perfil.');

    const losesAdmin =
      target.role === 'ADMIN' && target.active && (data.active === false || (data.role && data.role !== 'ADMIN'));
    if (losesAdmin) {
      const admins = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
      if (admins <= 1) throw badRequest('É preciso manter ao menos um administrador ativo.');
    }

    const user = await prisma.user.update({ where: { id: target.id }, data, select: SELECT });
    clearUserCache(target.id);
    return res.json(user);
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const data = z.object({ password }).parse(req.body);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash: await bcrypt.hash(data.password, 10) },
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

/** POST /api/auth/change-password — o próprio usuário troca a senha. */
async function changeOwnPassword(req, res, next) {
  try {
    const data = z
      .object({ currentPassword: z.string().min(1, 'Informe a senha atual.'), newPassword: password })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) throw notFound('Usuário não encontrado.');
    const ok = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!ok) throw badRequest('A senha atual está incorreta.');
    if (data.currentPassword === data.newPassword) throw badRequest('A nova senha deve ser diferente da atual.');
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(data.newPassword, 10) } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, create, update, resetPassword, changeOwnPassword };
