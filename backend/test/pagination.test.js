const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePagination, parseBool } = require('../src/lib/pagination');

const sortMap = { name: (o) => ({ name: o }), createdAt: (o) => ({ createdAt: o }) };

test('sem page = modo legado (array)', () => {
  assert.equal(parsePagination({}, { sortMap, defaultSort: 'name' }).paginated, false);
});

test('page/pageSize com limites', () => {
  const p = parsePagination({ page: '3', pageSize: '500' }, { sortMap, defaultSort: 'name' });
  assert.equal(p.paginated, true);
  assert.equal(p.pageSize, 100);
  assert.equal(p.skip, 200);
  const q = parsePagination({ page: '-1', pageSize: 'abc' }, { sortMap, defaultSort: 'name' });
  assert.equal(q.page, 1);
  assert.equal(q.pageSize, 25);
});

test('ordenação só aceita campos permitidos (sem injeção)', () => {
  const p = parsePagination({ page: '1', sort: 'passwordHash', order: 'desc' }, { sortMap, defaultSort: 'name' });
  assert.equal(p.sort, 'name');
  assert.deepEqual(p.orderBy, { name: 'desc' });
  const q = parsePagination({ page: '1', sort: 'createdAt', order: 'xpto' }, { sortMap, defaultSort: 'name', defaultOrder: 'desc' });
  assert.deepEqual(q.orderBy, { createdAt: 'desc' });
});

test('busca é aparada e limitada', () => {
  const p = parsePagination({ search: `  ${'a'.repeat(300)} ` }, { sortMap, defaultSort: 'name' });
  assert.equal(p.search.length, 100);
});

test('parseBool', () => {
  assert.equal(parseBool('true'), true);
  assert.equal(parseBool('false'), false);
  assert.equal(parseBool('x'), undefined);
});
