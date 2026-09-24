/**
 * Prepara a conexão para as ferramentas do PostgreSQL (pg_dump/pg_restore).
 * Módulo puro, testado em test/pgConnection.test.js.
 *
 *  - Remove parâmetros que só o Prisma entende (ex.: ?schema=public), que fariam
 *    o pg_dump recusar a URL.
 *  - Tira a senha da URL e passa por variável de ambiente (PGPASSWORD), para que
 *    ela não apareça na lista de processos do servidor.
 */
const PRISMA_ONLY_PARAMS = [
  'schema',
  'connection_limit',
  'pool_timeout',
  'pgbouncer',
  'socket_timeout',
  'statement_cache_size',
  'connect_timeout',
];

function pgToolConnection(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL não definida.');
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL inválida.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL não é uma conexão PostgreSQL.');
  }
  const password = decodeURIComponent(url.password || '');
  url.password = '';
  const schema = url.searchParams.get('schema');
  PRISMA_ONLY_PARAMS.forEach((p) => url.searchParams.delete(p));
  const env = {};
  if (password) env.PGPASSWORD = password;
  return {
    connectionString: url.toString(),
    env,
    schema: schema && schema !== 'public' ? schema : null,
    // Para mensagens e logs: nunca mostra a senha
    safeLabel: `${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`,
  };
}

module.exports = { pgToolConnection };

/**
 * Confere a listagem do `pg_restore --list` de um backup: devolve as tabelas
 * obrigatórias que NÃO aparecem com dados (vazio = backup completo).
 * Linha típica: "215; 0 16390 TABLE DATA public clients postgres"
 */
function missingTablesInListing(listing, requiredTables) {
  const found = new Set();
  for (const line of String(listing).split(/\r?\n/)) {
    if (line.trim().startsWith(';')) continue; // comentário
    const words = line.trim().split(/\s+/);
    const i = words.findIndex((w, idx) => w === 'TABLE' && words[idx + 1] === 'DATA');
    if (i >= 0 && words[i + 3]) found.add(words[i + 3]);
  }
  return requiredTables.filter((t) => !found.has(t));
}

module.exports.missingTablesInListing = missingTablesInListing;
