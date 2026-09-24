/** Mensagens do Zod em português (aplicado globalmente em server.js). */
const { z } = require('zod');

function zodPtBrErrorMap(issue, ctx) {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: 'Campo obrigatório.' };
      }
      return { message: 'Tipo de dado inválido.' };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return { message: issue.minimum <= 1 ? 'Campo obrigatório.' : `Informe ao menos ${issue.minimum} caracteres.` };
      }
      if (issue.type === 'number') return { message: `O valor mínimo é ${issue.minimum}.` };
      if (issue.type === 'array') return { message: `Selecione ao menos ${issue.minimum} item(ns).` };
      break;
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Máximo de ${issue.maximum} caracteres.` };
      if (issue.type === 'number') return { message: `O valor máximo é ${issue.maximum}.` };
      break;
    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Opção inválida.' };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'E-mail inválido.' };
      if (issue.validation === 'uuid') return { message: 'Identificador inválido.' };
      return { message: 'Formato inválido.' };
    case z.ZodIssueCode.invalid_date:
      return { message: 'Data inválida.' };
    default:
      break;
  }
  return { message: ctx.defaultError };
}

function applyZodLocale() {
  z.setErrorMap(zodPtBrErrorMap);
}

module.exports = { applyZodLocale, zodPtBrErrorMap };
