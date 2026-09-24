const test = require('node:test');
const assert = require('node:assert/strict');
const { pgToolConnection } = require('../src/lib/pgConnection');

test('remove parâmetros do Prisma e tira a senha da URL', () => {
  const c = pgToolConnection('postgresql://postgres:s3nh%40forte@db.local:5432/zevo_tech?schema=public&connection_limit=5&sslmode=require');
  assert.equal(c.connectionString, 'postgresql://postgres@db.local:5432/zevo_tech?sslmode=require');
  assert.equal(c.env.PGPASSWORD, 's3nh@forte');
  assert.equal(c.schema, null);
  assert.equal(c.safeLabel, 'db.local:5432/zevo_tech');
  assert.ok(!c.connectionString.includes('s3nh'));
});

test('schema diferente de public é informado; URLs inválidas são recusadas', () => {
  assert.equal(pgToolConnection('postgresql://u:p@h/db?schema=zevo').schema, 'zevo');
  assert.throws(() => pgToolConnection(''), /não definida/);
  assert.throws(() => pgToolConnection('mysql://u:p@h/db'), /não é uma conexão PostgreSQL/);
  assert.throws(() => pgToolConnection('isso não é url'), /inválida/);
});

const { missingTablesInListing } = require('../src/lib/pgConnection');

test('verificação do backup: encontra as tabelas na listagem do pg_restore', () => {
  const listing = [
    ';',
    '; Archive created at 2026-09-24 02:00:01 -03',
    ';     dbname: zevo_tech',
    '215; 0 16390 TABLE DATA public clients postgres',
    '216; 0 16400 TABLE DATA public service_orders',
    '217; 0 16410 TABLE DATA public clients_old postgres',
    '3001; 2606 16500 CONSTRAINT public equipments equipments_pkey postgres',
  ].join('\r\n');
  assert.deepEqual(missingTablesInListing(listing, ['clients', 'service_orders']), []);
  // equipments só aparece como CONSTRAINT (sem dados) → ausente
  assert.deepEqual(missingTablesInListing(listing, ['clients', 'equipments']), ['equipments']);
  // "clients_old" não conta como "clients"
  assert.deepEqual(missingTablesInListing('1; 0 1 TABLE DATA public clients_old x', ['clients']), ['clients']);
  assert.deepEqual(missingTablesInListing('', ['users']), ['users']);
});
