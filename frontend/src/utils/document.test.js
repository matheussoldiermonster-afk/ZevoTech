import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDocument, formatPhone, isValidCNPJ, isValidCPF } from './document.js';

test('formata CPF, CNPJ e telefone', () => {
  assert.equal(formatDocument('52998224725'), '529.982.247-25');
  assert.equal(formatDocument('11222333000181'), '11.222.333/0001-81');
  assert.equal(formatDocument('123'), '123');
  assert.equal(formatPhone('61999998888'), '(61) 99999-8888');
});

test('valida dígitos verificadores', () => {
  assert.equal(isValidCPF('529.982.247-25'), true);
  assert.equal(isValidCPF('529.982.247-24'), false);
  assert.equal(isValidCPF('111.111.111-11'), false);
  assert.equal(isValidCNPJ('11.222.333/0001-81'), true);
  assert.equal(isValidCNPJ('11.222.333/0001-80'), false);
});
