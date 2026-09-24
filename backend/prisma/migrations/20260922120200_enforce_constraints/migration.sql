-- =====================================================================
-- ZEVO v3 — M3: restrições de integridade
-- Antes de aplicar, verifica se os dados permitem. Se algo estiver
-- inconsistente, a migration ABORTA com mensagem explicando o que
-- corrigir. Nenhum dado é apagado automaticamente.
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "monthly_payments" GROUP BY "contractId", "reference" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'ZEVO: existem cobranças duplicadas (mesmo contrato e mesma referência). Liste com: SELECT "contractId", "reference", COUNT(*) FROM monthly_payments GROUP BY 1,2 HAVING COUNT(*) > 1; Resolva manualmente e rode a migration novamente.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "service_orders" GROUP BY "orderNumber" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'ZEVO: existem ordens de serviço com número repetido. Liste com: SELECT "orderNumber", COUNT(*) FROM service_orders GROUP BY 1 HAVING COUNT(*) > 1;';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "service_orders" WHERE "companyId" IS NULL OR "addressId" IS NULL
  ) THEN
    RAISE EXCEPTION 'ZEVO: há ordens de serviço sem empresa/endereço após o backfill. Verifique a migration 20260922120100.';
  END IF;

  IF EXISTS (SELECT 1 FROM "contracts" WHERE "companyId" IS NULL) THEN
    RAISE EXCEPTION 'ZEVO: há contratos sem empresa após o backfill. Verifique a migration 20260922120100.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "service_orders" ALTER COLUMN "companyId" SET NOT NULL,
ALTER COLUMN "addressId" SET NOT NULL;

-- AlterTable
ALTER TABLE "contracts" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "service_orders_orderNumber_key" ON "service_orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_payments_contractId_reference_key" ON "monthly_payments"("contractId", "reference");
