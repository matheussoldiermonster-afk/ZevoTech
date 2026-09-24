const prisma = require('../prismaClient');
const { runBackup, backupOverview } = require('../services/backupService');
const { conflict } = require('../lib/httpError');

/** GET /api/backups — situação, configuração e arquivos existentes. */
async function overview(req, res, next) {
  try {
    return res.json(await backupOverview());
  } catch (err) {
    return next(err);
  }
}

/** POST /api/backups/run — faz um backup agora. */
async function runNow(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { name: true } });
    const result = await runBackup({ reason: 'manual', userName: user?.name });
    return res.status(201).json(result);
  } catch (err) {
    if (err.code === 'BACKUP_BUSY') return next(conflict(err.message));
    // Erro do backup (ex.: pg_dump não encontrado): mensagem é útil para o administrador
    err.status = 500;
    err.name = 'HttpError';
    return next(err);
  }
}

module.exports = { overview, runNow };
