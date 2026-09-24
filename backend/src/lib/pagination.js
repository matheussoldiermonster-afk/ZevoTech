/**
 * Paginação, ordenação e busca padronizadas.
 *
 * Contrato: ?page=1&pageSize=25&sort=campo&order=asc|desc&search=texto
 * Resposta paginada: { data, total, page, pageSize }
 *
 * COMPATIBILIDADE: se `page` não for enviado, a rota devolve o array simples
 * (formato antigo) limitado a LEGACY_LIMIT registros. Usado apenas pelas telas
 * antigas enquanto o frontend é migrado (Lotes 2–4).
 */

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const LEGACY_LIMIT = 2000;

/**
 * @param {object} query req.query
 * @param {object} [opts]
 * @param {Record<string,(order:'asc'|'desc')=>object>} [opts.sortMap] campo → orderBy do Prisma
 * @param {string} [opts.defaultSort]
 * @param {'asc'|'desc'} [opts.defaultOrder]
 */
function parsePagination(query, { sortMap = {}, defaultSort, defaultOrder = 'asc' } = {}) {
  const paginated = query.page !== undefined && query.page !== '';
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawSize = parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  const sort = Object.prototype.hasOwnProperty.call(sortMap, query.sort) ? query.sort : defaultSort;
  let order = defaultOrder;
  if (query.order === 'asc' || query.order === 'desc') order = query.order;
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';

  return {
    paginated,
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    sort,
    order,
    search,
    orderBy: sort && sortMap[sort] ? sortMap[sort](order) : undefined,
  };
}

/**
 * Executa findMany + count com os parâmetros de paginação.
 * @param {object} prisma cliente Prisma (para $transaction)
 * @param {object} model delegate (ex.: prisma.client)
 */
async function paginate(prisma, model, args, p) {
  const { where, include, select } = args;
  const orderBy = args.orderBy || p.orderBy;

  if (!p.paginated) {
    const rows = await model.findMany({ where, include, select, orderBy, take: LEGACY_LIMIT });
    if (rows.length === LEGACY_LIMIT) {
      console.warn(`[pagination] listagem legada atingiu ${LEGACY_LIMIT} registros; migre a tela para paginação.`);
    }
    return rows;
  }

  const [data, total] = await prisma.$transaction([
    model.findMany({ where, include, select, orderBy, skip: p.skip, take: p.take }),
    model.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

/** Converte "true"/"false" de query string. */
function parseBool(value) {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}

module.exports = {
  parsePagination,
  paginate,
  parseBool,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  LEGACY_LIMIT,
};
