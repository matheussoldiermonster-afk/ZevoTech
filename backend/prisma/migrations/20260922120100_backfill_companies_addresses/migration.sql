-- =====================================================================
-- ZEVO v3 — M2: backfill dos dados existentes
-- Regras:
--   * Nada é apagado. Colunas legadas continuam preenchidas.
--   * Idempotente: cada passo só age em linhas ainda não migradas.
--   * Cada cliente existente recebe 1 empresa + 1 endereço principal,
--     copiados dos dados atuais do cliente. Nenhum dado é inventado:
--     campos vazios continuam vazios (a tela sinaliza "endereço incompleto").
-- =====================================================================

BEGIN;

-- 1) Uma empresa para cada cliente que ainda não tem empresa.
--    O documento só é copiado quando o cliente é pessoa jurídica (CNPJ).
INSERT INTO "companies" ("id", "clientId", "name", "document", "email", "phone", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       c."id",
       c."name",
       CASE WHEN c."documentType" = 'CNPJ' THEN c."document" ELSE NULL END,
       c."email",
       c."phone",
       c."active",
       c."createdAt",
       CURRENT_TIMESTAMP
FROM "clients" c
WHERE NOT EXISTS (SELECT 1 FROM "companies" co WHERE co."clientId" = c."id");

-- 2) Um endereço principal para cada empresa que ainda não tem endereço,
--    com os campos de endereço atuais do cliente.
INSERT INTO "addresses" ("id", "companyId", "label", "street", "city", "state", "zipCode", "isMain", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       co."id",
       'Principal',
       NULLIF(TRIM(c."address"), ''),
       NULLIF(TRIM(c."city"), ''),
       NULLIF(TRIM(c."state"), ''),
       NULLIF(TRIM(c."zipCode"), ''),
       true,
       true,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "companies" co
JOIN "clients" c ON c."id" = co."clientId"
WHERE NOT EXISTS (SELECT 1 FROM "addresses" a WHERE a."companyId" = co."id");

-- Neste ponto cada cliente migrado tem exatamente 1 empresa com 1 endereço
-- principal, então os vínculos abaixo são determinísticos.

-- 3) Ordens de serviço → empresa + endereço do cliente.
UPDATE "service_orders" so
SET "companyId" = co."id",
    "addressId" = a."id"
FROM "companies" co
JOIN "addresses" a ON a."companyId" = co."id" AND a."isMain" = true
WHERE co."clientId" = so."clientId"
  AND so."companyId" IS NULL;

-- 4) Contratos → empresa + endereço do cliente.
UPDATE "contracts" ct
SET "companyId" = co."id",
    "addressId" = a."id"
FROM "companies" co
JOIN "addresses" a ON a."companyId" = co."id" AND a."isMain" = true
WHERE co."clientId" = ct."clientId"
  AND ct."companyId" IS NULL;

-- 5) Status do contrato a partir do campo "active" existente.
UPDATE "contracts"
SET "status" = 'CANCELLED'::"ContractStatus"
WHERE "active" = false AND "status" = 'ACTIVE'::"ContractStatus";

-- 6) Equipamentos vinculados a um cliente → endereço principal dele.
UPDATE "equipments" e
SET "addressId" = a."id"
FROM "companies" co
JOIN "addresses" a ON a."companyId" = co."id" AND a."isMain" = true
WHERE co."clientId" = e."clientId"
  AND e."clientId" IS NOT NULL
  AND e."addressId" IS NULL;

-- 7) Vencimento da cobrança avulsa das OS com valor (antes não existia).
--    Usa a data de conclusão; se não houver, a data de abertura.
--    Gravado como data civil (00:00 UTC do dia em America/Sao_Paulo).
UPDATE "service_orders"
SET "dueDate" = date_trunc('day', (COALESCE("completedAt", "openedAt") AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')
WHERE "dueDate" IS NULL
  AND "totalValue" > 0;

-- 8) Agenda: toda OS com data agendada (campo legado) ganha um registro em
--    "schedules", que passa a ser a fonte oficial da agenda.
INSERT INTO "schedules" ("id", "serviceOrderId", "date", "time", "period", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       so."id",
       so."scheduledDate",
       NULL,
       so."period",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "service_orders" so
WHERE so."scheduledDate" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "schedules" s WHERE s."serviceOrderId" = so."id");

-- 9) Histórico inicial de cada OS existente (marco de migração).
INSERT INTO "service_order_history" ("id", "serviceOrderId", "action", "toStatus", "note", "createdAt")
SELECT gen_random_uuid()::text,
       so."id",
       'MIGRATED',
       so."status",
       'Registro existente antes da versão 3 (empresa e endereço vinculados automaticamente).',
       CURRENT_TIMESTAMP
FROM "service_orders" so
WHERE NOT EXISTS (SELECT 1 FROM "service_order_history" h WHERE h."serviceOrderId" = so."id");

COMMIT;
