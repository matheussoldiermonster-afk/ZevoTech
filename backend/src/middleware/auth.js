const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const ROLES = Object.freeze({ ADMIN: 'ADMIN', FINANCIAL: 'FINANCIAL' });

/**
 * O token (JWT) vale por horas. Para que desativar um usuário ou mudar o perfil
 * tenha efeito imediato, conferimos o usuário no banco — com um cache curto para
 * não fazer uma consulta a cada requisição.
 */
const CACHE_TTL_MS = 30 * 1000;
const userCache = new Map();

async function currentUserState(id) {
  const cached = userCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, active: true } });
  userCache.set(id, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

function clearUserCache(id) {
  if (id) userCache.delete(id);
  else userCache.clear();
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Sessão não encontrada. Faça login novamente.' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Sua sessão expirou. Faça login novamente.' });
  }

  try {
    const state = await currentUserState(payload.sub);
    if (!state || !state.active) {
      return res.status(401).json({ error: 'Seu acesso foi desativado. Fale com um administrador.' });
    }
    // O perfil vem do banco, não do token (mudanças de perfil valem na hora)
    req.user = { ...payload, role: state.role };
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Você não tem permissão para esta ação.' });
    }
    return next();
  };
}

/** Somente administradores. */
const adminOnly = requireRole(ROLES.ADMIN);
/** Administradores e financeiro. */
const financeWrite = requireRole(ROLES.ADMIN, ROLES.FINANCIAL);

module.exports = { authMiddleware, requireRole, adminOnly, financeWrite, ROLES, clearUserCache };
