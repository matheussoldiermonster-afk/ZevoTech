/**
 * Resolução e validação da cadeia Cliente → Empresa → Endereço → Equipamento.
 * Garante no backend que os vínculos são coerentes (não confia no frontend).
 */
const { badRequest } = require('../lib/httpError');

/**
 * Resolve e valida { clientId, companyId, addressId }.
 *
 * COMPATIBILIDADE com as telas antigas (que só enviam clientId):
 * se companyId não vier, usa a empresa do cliente quando ele tem exatamente
 * uma empresa ativa; se addressId não vier (e for obrigatório), usa o único
 * endereço ativo da empresa ou o endereço principal. Caso contrário, pede
 * a seleção explícita.
 *
 * @param {object} tx cliente Prisma ou transação
 * @param {{clientId?:string, companyId?:string|null, addressId?:string|null}} input
 * @param {{requireAddress?:boolean}} [opts]
 */
async function resolveLocation(tx, input, { requireAddress = true } = {}) {
  let { clientId, companyId, addressId } = input;

  if (!companyId) {
    if (!clientId) throw badRequest('Selecione o cliente e a empresa.');
    const companies = await tx.company.findMany({
      where: { clientId, active: true },
      select: { id: true },
      take: 2,
    });
    if (companies.length === 0) {
      throw badRequest('Este cliente ainda não tem empresa cadastrada. Cadastre uma empresa antes de continuar.');
    }
    if (companies.length > 1) throw badRequest('Selecione a empresa do cliente.');
    companyId = companies[0].id;
  }

  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: { id: true, clientId: true, active: true },
  });
  if (!company) throw badRequest('Empresa não encontrada.');
  if (clientId && company.clientId !== clientId) {
    throw badRequest('A empresa selecionada não pertence a este cliente.');
  }
  if (!company.active) throw badRequest('A empresa selecionada está inativa.');
  clientId = company.clientId;

  if (!addressId && requireAddress) {
    const addresses = await tx.address.findMany({
      where: { companyId, active: true },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, isMain: true },
      take: 2,
    });
    if (addresses.length === 0) {
      throw badRequest('Esta empresa não tem endereço cadastrado. Cadastre o endereço do atendimento.');
    }
    if (addresses.length === 1 || addresses[0].isMain) {
      addressId = addresses[0].id;
    } else {
      throw badRequest('Selecione o endereço do atendimento.');
    }
  }

  if (addressId) {
    const address = await tx.address.findUnique({
      where: { id: addressId },
      select: { id: true, companyId: true, active: true },
    });
    if (!address) throw badRequest('Endereço não encontrado.');
    if (address.companyId !== companyId) {
      throw badRequest('O endereço selecionado não pertence a esta empresa.');
    }
    if (!address.active) throw badRequest('O endereço selecionado está inativo.');
  }

  return { clientId, companyId, addressId: addressId || null };
}

/** Busca cliente/empresa donos de um endereço. */
async function ownerOfAddress(tx, addressId) {
  const address = await tx.address.findUnique({
    where: { id: addressId },
    select: { id: true, active: true, companyId: true, company: { select: { clientId: true } } },
  });
  if (!address) throw badRequest('Endereço não encontrado.');
  if (!address.active) throw badRequest('O endereço selecionado está inativo.');
  return { addressId: address.id, companyId: address.companyId, clientId: address.company.clientId };
}

module.exports = { resolveLocation, ownerOfAddress };
