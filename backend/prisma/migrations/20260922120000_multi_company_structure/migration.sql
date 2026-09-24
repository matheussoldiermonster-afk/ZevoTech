-- =====================================================================
-- ZEVO v3 — M1: estrutura Cliente → Empresa → Endereço
-- Somente cria estruturas. Nenhum dado existente é alterado ou removido.
-- Requer PostgreSQL 13+ (gen_random_uuid() nativo, usado na M2).
-- =====================================================================

-- CreateEnum
CREATE TYPE "ContractPeriodicity" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'ENDED');

-- CreateEnum
CREATE TYPE "EquipmentMovementType" AS ENUM ('ENTRY', 'INSTALL', 'REMOVE', 'TRANSFER', 'TO_MAINTENANCE', 'FROM_MAINTENANCE', 'DAMAGED', 'DISCARD', 'STATUS_CHANGE');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Principal',
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "reference" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technicians" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_equipments" (
    "serviceOrderId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_equipments_pkey" PRIMARY KEY ("serviceOrderId","equipmentId")
);

-- CreateTable
CREATE TABLE "service_order_history" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "ServiceOrderStatus",
    "toStatus" "ServiceOrderStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_movements" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" "EquipmentMovementType" NOT NULL,
    "fromStatus" "EquipmentStatus",
    "toStatus" "EquipmentStatus",
    "fromAddressId" TEXT,
    "toAddressId" TEXT,
    "serviceOrderId" TEXT,
    "userId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_movements_pkey" PRIMARY KEY ("id")
);

-- AlterTable (colunas novas nulas; a M3 aplica NOT NULL depois do backfill)
ALTER TABLE "contracts" ADD COLUMN     "addressId" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "periodicity" "ContractPeriodicity" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "service_orders" ADD COLUMN     "addressId" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "technicianId" TEXT;

-- AlterTable (período passa a ser opcional: o agendamento pode ter só horário)
ALTER TABLE "schedules" ADD COLUMN     "technicianId" TEXT,
ALTER COLUMN "period" DROP NOT NULL;

-- AlterTable
ALTER TABLE "equipments" ADD COLUMN     "addressId" TEXT;

-- CreateIndex
CREATE INDEX "clients_createdAt_idx" ON "clients"("createdAt");

-- CreateIndex
CREATE INDEX "companies_clientId_idx" ON "companies"("clientId");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "companies_document_key" ON "companies"("document");

-- CreateIndex
CREATE INDEX "addresses_companyId_idx" ON "addresses"("companyId");

-- CreateIndex
CREATE INDEX "addresses_city_idx" ON "addresses"("city");

-- CreateIndex
CREATE INDEX "technicians_name_idx" ON "technicians"("name");

-- CreateIndex
CREATE INDEX "contracts_companyId_idx" ON "contracts"("companyId");

-- CreateIndex
CREATE INDEX "contracts_addressId_idx" ON "contracts"("addressId");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "monthly_payments_dueDate_idx" ON "monthly_payments"("dueDate");

-- CreateIndex
CREATE INDEX "monthly_payments_paidAt_idx" ON "monthly_payments"("paidAt");

-- CreateIndex
CREATE INDEX "service_orders_companyId_idx" ON "service_orders"("companyId");

-- CreateIndex
CREATE INDEX "service_orders_addressId_idx" ON "service_orders"("addressId");

-- CreateIndex
CREATE INDEX "service_orders_technicianId_idx" ON "service_orders"("technicianId");

-- CreateIndex
CREATE INDEX "service_orders_priority_idx" ON "service_orders"("priority");

-- CreateIndex
CREATE INDEX "service_orders_dueDate_idx" ON "service_orders"("dueDate");

-- CreateIndex
CREATE INDEX "service_orders_paidAt_idx" ON "service_orders"("paidAt");

-- CreateIndex
CREATE INDEX "service_orders_createdAt_idx" ON "service_orders"("createdAt");

-- CreateIndex
CREATE INDEX "service_order_equipments_equipmentId_idx" ON "service_order_equipments"("equipmentId");

-- CreateIndex
CREATE INDEX "service_order_history_serviceOrderId_idx" ON "service_order_history"("serviceOrderId");

-- CreateIndex
CREATE INDEX "service_order_history_createdAt_idx" ON "service_order_history"("createdAt");

-- CreateIndex
CREATE INDEX "schedules_date_technicianId_idx" ON "schedules"("date", "technicianId");

-- CreateIndex
CREATE INDEX "equipments_addressId_idx" ON "equipments"("addressId");

-- CreateIndex
CREATE INDEX "equipment_movements_equipmentId_idx" ON "equipment_movements"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_movements_createdAt_idx" ON "equipment_movements"("createdAt");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_equipments" ADD CONSTRAINT "service_order_equipments_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_equipments" ADD CONSTRAINT "service_order_equipments_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_history" ADD CONSTRAINT "service_order_history_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_history" ADD CONSTRAINT "service_order_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_fromAddressId_fkey" FOREIGN KEY ("fromAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_toAddressId_fkey" FOREIGN KEY ("toAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
