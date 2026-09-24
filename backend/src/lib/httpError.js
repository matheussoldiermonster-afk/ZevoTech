/** Erro de negócio com status HTTP e mensagem amigável para o usuário. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const notFound = (msg = 'Registro não encontrado.') => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);

module.exports = { HttpError, badRequest, notFound, conflict };
