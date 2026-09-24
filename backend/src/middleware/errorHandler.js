/**
 * Tratamento central de erros.
 * O usuário recebe sempre uma mensagem amigável; detalhes técnicos ficam só no log.
 */
function friendlyZodDetails(err) {
  return err.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // JSON malformado no corpo
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Não foi possível ler os dados enviados.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Os dados enviados são grandes demais.' });
  }

  if (err.name === 'ZodError') {
    const details = friendlyZodDetails(err);
    const first = details[0];
    return res.status(400).json({
      error: first ? `Verifique os dados informados: ${first.message}` : 'Dados inválidos.',
      details,
    });
  }

  if (err.name === 'HttpError') {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // Erros conhecidos do Prisma
  if (err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target;
    return res.status(409).json({
      error: 'Já existe um registro com esse valor (deve ser único).',
      field: target,
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro não encontrado.' });
  }
  if (err.code === 'P2003') {
    return res.status(409).json({
      error: 'Esta operação não é possível porque o registro está vinculado a outros dados.',
    });
  }

  console.error(`[erro] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({
    error: 'Ocorreu um erro inesperado no servidor. Tente novamente em instantes.',
  });
}

module.exports = errorHandler;
