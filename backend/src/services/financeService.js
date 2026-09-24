/**
 * Serviço financeiro unificado.
 *
 * O ZEVO tem duas origens de recebíveis:
 *   - CONTRACT:       cobranças recorrentes (tabela monthly_payments)
 *   - SERVICE_ORDER:  cobrança avulsa da OS (colunas de pagamento em service_orders)
 *
 * Todas as telas e indicadores financeiros leem daqui, para que os números
 * sejam sempre os mesmos em Dashboard, Financeiro e Relatórios.
 *
 * Regras:
 *  - Previsto do mês: cobranças não canceladas com VENCIMENTO no mês.
 *  - Recebido do mês: cobranças pagas com DATA DE PAGAMENTO no mês (fuso da empresa).
 *  - Em aberto do mês: cobranças do mês ainda não pagas.
 *  - Atrasado: não paga e vencida (vencimento < hoje). Calculado na leitura
 *    e também gravado periodicamente pelo job jobs/overdueJob.js.
 *  - OS avulsa só entra no financeiro se tiver valor > 0 e não estiver cancelada.
 *    Sem vencimento definido, usa o dia do pagamento (se já paga).
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../prismaClient');
const {
  todayCivil,
  monthRange,
  appTimeZone,
  shiftMonth,
  formatMonth,
  monthDiff,
} = require('../lib/dates');

/** Date → literal timestamp SEM fuso (as colunas são timestamp(3) em UTC). */
function ts(date) {
  const iso = date.toISOString().replace('T', ' ').replace('Z', '');
  return Prisma.sql`${iso}::timestamp`;
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** CTE com todos os recebíveis e o status efetivo. */
function receivablesCte(today = todayCivil()) {
  const tz = appTimeZone();
  return Prisma.sql`
    WITH base AS (
      SELECT 'CONTRACT'::text          AS source,
             mp."id"                   AS id,
             ct."clientId"             AS "clientId",
             ct."companyId"            AS "companyId",
             ct."addressId"            AS "addressId",
             ct."id"                   AS "contractId",
             NULL::text                AS "serviceOrderId",
             NULL::int                 AS "orderNumber",
             mp."reference"            AS reference,
             mp."dueDate"              AS "dueDate",
             mp."amount"               AS amount,
             mp."status"::text         AS "rawStatus",
             mp."paidAt"               AS "paidAt",
             mp."method"::text         AS method
      FROM "monthly_payments" mp
      JOIN "contracts" ct ON ct."id" = mp."contractId"
      UNION ALL
      SELECT 'SERVICE_ORDER'::text,
             so."id",
             so."clientId",
             so."companyId",
             so."addressId",
             NULL::text,
             so."id",
             so."orderNumber",
             NULL::timestamp,
             COALESCE(so."dueDate", date_trunc('day', (so."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})),
             so."totalValue",
             so."paymentStatus"::text,
             so."paidAt",
             so."paymentMethod"::text
      FROM "service_orders" so
      WHERE so."totalValue" > 0
        AND so."status" <> 'CANCELLED'
    ),
    receivables AS (
      SELECT b.*,
             CASE
               WHEN b."rawStatus" = 'PENDING' AND b."dueDate" IS NOT NULL AND b."dueDate" < ${ts(today)}
                 THEN 'OVERDUE'
               ELSE b."rawStatus"
             END AS status
      FROM base b
    )`;
}

const SORT_COLUMNS = {
  dueDate: Prisma.raw('r."dueDate"'),
  amount: Prisma.raw('r.amount'),
  clientName: Prisma.raw('c.name'),
  companyName: Prisma.raw('co.name'),
  status: Prisma.raw('r.status'),
  paidAt: Prisma.raw('r."paidAt"'),
};

const VALID_STATUS = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];

/**
 * Lista paginada de recebíveis.
 * @param {object} f filtros já validados
 */
async function listReceivables(f) {
  const conds = [];
  if (f.status && f.status.length) {
    const statuses = f.status.filter((s) => VALID_STATUS.includes(s));
    if (statuses.length) conds.push(Prisma.sql`r.status IN (${Prisma.join(statuses)})`);
  }
  if (f.source) conds.push(Prisma.sql`r.source = ${f.source}`);
  if (f.clientId) conds.push(Prisma.sql`r."clientId" = ${f.clientId}`);
  if (f.companyId) conds.push(Prisma.sql`r."companyId" = ${f.companyId}`);
  if (f.addressId) conds.push(Prisma.sql`r."addressId" = ${f.addressId}`);
  if (f.contractId) conds.push(Prisma.sql`r."contractId" = ${f.contractId}`);
  if (f.serviceOrderId) conds.push(Prisma.sql`r."serviceOrderId" = ${f.serviceOrderId}`);
  if (f.dueFrom) conds.push(Prisma.sql`r."dueDate" >= ${ts(f.dueFrom)}`);
  if (f.dueTo) conds.push(Prisma.sql`r."dueDate" <= ${ts(f.dueTo)}`);
  if (f.paidFrom) conds.push(Prisma.sql`r."paidAt" >= ${ts(f.paidFrom)}`);
  if (f.paidTo) conds.push(Prisma.sql`r."paidAt" < ${ts(f.paidTo)}`);
  if (f.search) {
    const like = `%${escapeLike(f.search)}%`;
    conds.push(Prisma.sql`(
      c.name ILIKE ${like}
      OR co.name ILIKE ${like}
      OR co."tradeName" ILIKE ${like}
      OR CAST(r."orderNumber" AS text) = ${f.search.replace(/^#/, '')}
    )`);
  }

  const where = conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty;
  const sortCol = SORT_COLUMNS[f.sort] || SORT_COLUMNS.dueDate;
  const direction = f.order === 'desc' ? Prisma.raw('DESC') : Prisma.raw('ASC');
  const from = Prisma.sql`
    FROM receivables r
    JOIN "clients" c ON c."id" = r."clientId"
    LEFT JOIN "companies" co ON co."id" = r."companyId"
    LEFT JOIN "addresses" a ON a."id" = r."addressId"`;

  const cte = receivablesCte();
  const [rows, totals] = await Promise.all([
    prisma.$queryRaw`${cte}
      SELECT r.*,
             c.name        AS "clientName",
             co.name       AS "companyName",
             a.label       AS "addressLabel",
             a.street      AS "addressStreet",
             a.number      AS "addressNumber",
             a.district    AS "addressDistrict",
             a.city        AS "addressCity"
      ${from}
      ${where}
      ORDER BY ${sortCol} ${direction} NULLS LAST, r.id ASC
      LIMIT ${f.take} OFFSET ${f.skip}`,
    prisma.$queryRaw`${cte}
      SELECT COUNT(*)::int AS total, COALESCE(SUM(r.amount), 0) AS "totalAmount"
      ${from}
      ${where}`,
  ]);

  return {
    data: rows.map((r) => ({ ...r, amount: Number(r.amount) })),
    total: totals[0].total,
    totalAmount: Number(totals[0].totalAmount),
    page: f.page,
    pageSize: f.pageSize,
  };
}

/**
 * Indicadores financeiros de um mês { year, month }.
 * Todos os valores vêm de uma única consulta (consistência entre os números).
 */
async function monthSummary(ref) {
  const r = monthRange(ref);
  const inMonth = Prisma.sql`"dueDate" >= ${ts(r.civilStart)} AND "dueDate" < ${ts(r.civilEnd)}`;
  const paidInMonth = Prisma.sql`"rawStatus" = 'PAID' AND "paidAt" >= ${ts(r.instantStart)} AND "paidAt" < ${ts(r.instantEnd)}`;

  const rows = await prisma.$queryRaw`${receivablesCte()}
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE ${inMonth} AND "rawStatus" <> 'CANCELLED'), 0) AS expected,
      COUNT(*) FILTER (WHERE ${inMonth} AND "rawStatus" <> 'CANCELLED')::int            AS "expectedCount",
      COALESCE(SUM(amount) FILTER (WHERE ${paidInMonth}), 0)                              AS received,
      COUNT(*) FILTER (WHERE ${paidInMonth})::int                                         AS "receivedCount",
      COALESCE(SUM(amount) FILTER (WHERE ${inMonth} AND status IN ('PENDING','OVERDUE')), 0) AS open,
      COUNT(*) FILTER (WHERE ${inMonth} AND status = 'PAID')::int                         AS "paidCount",
      COALESCE(SUM(amount) FILTER (WHERE ${inMonth} AND status = 'PAID'), 0)              AS "paidAmount",
      COALESCE(SUM(amount) FILTER (WHERE ${inMonth} AND status = 'PENDING'), 0)           AS "pendingAmount",
      COALESCE(SUM(amount) FILTER (WHERE ${inMonth} AND status = 'OVERDUE'), 0)           AS "overdueAmount",
      COUNT(*) FILTER (WHERE ${inMonth} AND status = 'PENDING')::int                      AS "pendingCount",
      COUNT(*) FILTER (WHERE ${inMonth} AND status = 'OVERDUE')::int                      AS "overdueCount",
      COALESCE(SUM(amount) FILTER (WHERE status = 'OVERDUE'), 0)                          AS "overdueTotal",
      COUNT(*) FILTER (WHERE status = 'OVERDUE')::int                                     AS "overdueTotalCount"
    FROM receivables`;

  const s = rows[0];
  return {
    month: formatMonth(ref),
    expected: Number(s.expected),
    expectedCount: s.expectedCount,
    received: Number(s.received),
    receivedCount: s.receivedCount,
    open: Number(s.open),
    // Situação das cobranças COM VENCIMENTO no mês
    paidCount: s.paidCount,
    paidAmount: Number(s.paidAmount),
    pendingCount: s.pendingCount,
    pendingAmount: Number(s.pendingAmount),
    overdueCount: s.overdueCount,
    overdueAmount: Number(s.overdueAmount),
    // Total atrasado de todos os meses
    overdueTotal: Number(s.overdueTotal),
    overdueTotalCount: s.overdueTotalCount,
  };
}

/**
 * Série mensal previsto × recebido, de `from` até `to` (inclusivo).
 * Meses sem movimento aparecem com 0 (a série nunca "pula" meses).
 */
async function monthlySeries(from, to) {
  const months = monthDiff(from, to);
  if (months < 0) return [];
  const start = monthRange(from);
  const end = monthRange(to);
  const tz = appTimeZone();

  const [expectedRows, receivedRows] = await Promise.all([
    prisma.$queryRaw`${receivablesCte()}
      SELECT to_char(date_trunc('month', "dueDate"), 'YYYY-MM') AS month, SUM(amount) AS total
      FROM receivables
      WHERE "rawStatus" <> 'CANCELLED'
        AND "dueDate" >= ${ts(start.civilStart)} AND "dueDate" < ${ts(end.civilEnd)}
      GROUP BY 1`,
    prisma.$queryRaw`${receivablesCte()}
      SELECT to_char(date_trunc('month', ("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), 'YYYY-MM') AS month,
             SUM(amount) AS total
      FROM receivables
      WHERE "rawStatus" = 'PAID'
        AND "paidAt" >= ${ts(start.instantStart)} AND "paidAt" < ${ts(end.instantEnd)}
      GROUP BY 1`,
  ]);

  const expected = new Map(expectedRows.map((r) => [r.month, Number(r.total)]));
  const received = new Map(receivedRows.map((r) => [r.month, Number(r.total)]));
  const series = [];
  for (let i = 0; i <= months; i += 1) {
    const key = formatMonth(shiftMonth(from, i));
    series.push({ month: key, expected: expected.get(key) || 0, received: received.get(key) || 0 });
  }
  return series;
}

/**
 * Condição Prisma para filtrar pelo status EFETIVO de uma cobrança.
 * Usado nas listagens via ORM (ex.: /monthly-payments).
 */
function effectiveStatusWhere(status, { statusField = 'status', dueField = 'dueDate' } = {}, today = todayCivil()) {
  if (status === 'OVERDUE') {
    return {
      OR: [{ [statusField]: 'OVERDUE' }, { [statusField]: 'PENDING', [dueField]: { lt: today } }],
    };
  }
  if (status === 'PENDING') {
    return {
      [statusField]: 'PENDING',
      OR: [{ [dueField]: null }, { [dueField]: { gte: today } }],
    };
  }
  return { [statusField]: status };
}

/** Status efetivo de um registro já carregado. */
function effectiveStatus(rawStatus, dueDate, today = todayCivil()) {
  if (rawStatus === 'PENDING' && dueDate && new Date(dueDate) < today) return 'OVERDUE';
  return rawStatus;
}

/**
 * Clientes inadimplentes (com ao menos uma cobrança atrasada), do maior
 * valor em atraso para o menor.
 */
async function overdueByClient() {
  const rows = await prisma.$queryRaw`${receivablesCte()}
    SELECT r."clientId" AS "clientId",
           c.name        AS "clientName",
           COUNT(*)::int AS count,
           SUM(r.amount) AS total,
           MIN(r."dueDate") AS "oldestDueDate"
    FROM receivables r
    JOIN "clients" c ON c."id" = r."clientId"
    WHERE r.status = 'OVERDUE'
    GROUP BY r."clientId", c.name
    ORDER BY SUM(r.amount) DESC, c.name ASC`;
  return rows.map((r) => ({ ...r, total: Number(r.total) }));
}

module.exports = {
  overdueByClient,
  listReceivables,
  monthSummary,
  monthlySeries,
  effectiveStatusWhere,
  effectiveStatus,
};
