-- =====================================================================
-- ZEVO — Equipamentos por quantidade
--  * equipments.quantity: unidades daquele equipamento no local/situação.
--  * Consolida cadastros repetidos: N registros do mesmo tipo, na mesma
--    situação e no mesmo endereço viram 1 registro com quantidade N.
--    Nada é perdido: histórico e vínculos com OS passam para o registro
--    consolidado e os números de série vão para as observações.
--  * Vínculo OS x equipamento ganha quantidade e o efeito no estoque.
-- Requer PostgreSQL 13+.
-- =====================================================================

-- Novo valor de enum fora da transação abaixo (não é usado nesta migration)
ALTER TYPE "EquipmentMovementType" ADD VALUE IF NOT EXISTS 'EXIT';

BEGIN;

-- CreateEnum
CREATE TYPE "ServiceOrderEquipmentAction" AS ENUM ('CONSUME', 'RETURN', 'REFERENCE');

-- AlterTable
ALTER TABLE "equipments" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "equipment_movements" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "service_order_equipments" ADD COLUMN "action" "ServiceOrderEquipmentAction" NOT NULL DEFAULT 'REFERENCE',
ADD COLUMN "applied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- Proteção no banco: estoque nunca negativo
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_quantity_check" CHECK ("quantity" >= 0);
ALTER TABLE "service_order_equipments" ADD CONSTRAINT "service_order_equipments_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_quantity_check" CHECK ("quantity" > 0);

-- ---------------------------------------------------------------------
-- Consolidação dos cadastros individuais em registros com quantidade
-- (descartados ficam como estão)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE eq_groups ON COMMIT DROP AS
SELECT e."id",
       FIRST_VALUE(e."id") OVER (
         PARTITION BY e."equipmentTypeId", e."status", e."addressId"
         ORDER BY e."createdAt", e."id"
       ) AS survivor
FROM "equipments" e
WHERE e."status" <> 'DISCARDED';

CREATE TEMP TABLE eq_merge ON COMMIT DROP AS
SELECT g.survivor,
       COUNT(*)::int AS n,
       string_agg(e."serialNumber", ', ' ORDER BY e."serialNumber") AS serials,
       MIN(e."installationDate") AS first_install
FROM eq_groups g
JOIN "equipments" e ON e."id" = g."id"
GROUP BY g.survivor
HAVING COUNT(*) > 1;

-- Vínculos com OS: somam as unidades que apontavam para o mesmo registro consolidado
CREATE TEMP TABLE soe_new ON COMMIT DROP AS
SELECT soe."serviceOrderId",
       COALESCE(g.survivor, soe."equipmentId") AS "equipmentId",
       SUM(soe."quantity")::int AS "quantity",
       MIN(soe."createdAt") AS "createdAt"
FROM "service_order_equipments" soe
LEFT JOIN eq_groups g ON g."id" = soe."equipmentId"
GROUP BY 1, 2;

DELETE FROM "service_order_equipments";
INSERT INTO "service_order_equipments" ("serviceOrderId", "equipmentId", "quantity", "createdAt")
SELECT "serviceOrderId", "equipmentId", "quantity", "createdAt" FROM soe_new;

-- Histórico de movimentações passa para o registro consolidado
UPDATE "equipment_movements" m
SET "equipmentId" = g.survivor
FROM eq_groups g
WHERE m."equipmentId" = g."id" AND g."id" <> g.survivor;

-- Remove os registros repetidos (antes de atualizar o sobrevivente, por causa do nº de série único)
DELETE FROM "equipments" e
USING eq_groups g
WHERE e."id" = g."id" AND g."id" <> g.survivor;

-- Registro consolidado recebe a quantidade; números de série vão para as observações
UPDATE "equipments" e
SET "quantity" = m.n,
    "serialNumber" = NULL,
    "installationDate" = COALESCE(m.first_install, e."installationDate"),
    "notes" = CASE
      WHEN m.serials IS NULL THEN e."notes"
      ELSE concat_ws(E'\n', e."notes", 'Nº de série das unidades consolidadas: ' || m.serials)
    END
FROM eq_merge m
WHERE e."id" = m.survivor;

-- ---------------------------------------------------------------------
-- Efeito de cada vínculo OS x equipamento no estoque
--  * Instalação  → CONSUME (sai do estoque para o endereço)
--  * Retirada    → RETURN  (volta do endereço para o estoque)
--  * Demais      → REFERENCE (sem efeito; era assim na versão anterior)
-- OS de instalação/retirada já concluídas tiveram o efeito aplicado pelo
-- modelo anterior, por isso ficam com applied = true (evita aplicar de novo).
-- ---------------------------------------------------------------------
UPDATE "service_order_equipments" soe
SET "action" = CASE so."type"
                 WHEN 'INSTALLATION' THEN 'CONSUME'::"ServiceOrderEquipmentAction"
                 WHEN 'KIT_REMOVAL'  THEN 'RETURN'::"ServiceOrderEquipmentAction"
                 ELSE 'REFERENCE'::"ServiceOrderEquipmentAction"
               END,
    "applied" = (so."status" = 'COMPLETED' AND so."type" IN ('INSTALLATION', 'KIT_REMOVAL'))
FROM "service_orders" so
WHERE so."id" = soe."serviceOrderId";

-- CreateIndex
CREATE INDEX "equipments_equipmentTypeId_status_addressId_idx" ON "equipments"("equipmentTypeId", "status", "addressId");

COMMIT;
