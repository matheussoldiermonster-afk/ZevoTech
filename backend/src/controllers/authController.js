const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../prismaClient');

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
  role: z.enum(['ADMIN', 'FINANCIAL']).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: 'insensitive' } } });
    if (existing) {
      return res.status(409).json({ error: 'Já existe um usuário com esse e-mail.' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role || 'FINANCIAL', // menor privilégio por padrão
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return res.status(201).json(user);
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Busca sem diferenciar maiúsculas (usuários antigos podem ter e-mail com maiúsculas)
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { sub: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário inativo ou removido. Faça login novamente.' });
    }
    return res.json(user);
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, me };
