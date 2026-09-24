-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FINANCIAL');

-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceOrderType" AS ENUM ('INSTALLATION', 'CORRECTIVE', 'PREVENTIVE', 'KIT_REMOVAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceOrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'BOLETO');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('IN_STOCK', 'INSTALLED', 'MAINTENANCE', 'DAMAGED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "SchedulePeriod" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'CNPJ',
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "monthlyValue" DECIMAL(10,2) NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_payments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "reference" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "method" "PaymentMethod",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ServiceOrderType" NOT NULL,
    "priority" "ServiceOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'OPEN',
    "totalValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "paidAt" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "period" "SchedulePeriod",
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_items" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitValue" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "service_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "period" "SchedulePeriod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "model" TEXT,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipments" (
    "id" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    "clientId" TEXT,
    "serialNumber" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'IN_STOCK',
    "installationDate" TIMESTAMP(3),
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_document_key" ON "clients"("document");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE INDEX "contracts_clientId_idx" ON "contracts"("clientId");

-- CreateIndex
CREATE INDEX "contracts_active_idx" ON "contracts"("active");

-- CreateIndex
CREATE INDEX "monthly_payments_contractId_idx" ON "monthly_payments"("contractId");

-- CreateIndex
CREATE INDEX "monthly_payments_status_idx" ON "monthly_payments"("status");

-- CreateIndex
CREATE INDEX "monthly_payments_reference_idx" ON "monthly_payments"("reference");

-- CreateIndex
CREATE INDEX "service_orders_clientId_idx" ON "service_orders"("clientId");

-- CreateIndex
CREATE INDEX "service_orders_status_idx" ON "service_orders"("status");

-- CreateIndex
CREATE INDEX "service_orders_type_idx" ON "service_orders"("type");

-- CreateIndex
CREATE INDEX "service_orders_scheduledDate_idx" ON "service_orders"("scheduledDate");

-- CreateIndex
CREATE INDEX "service_order_items_serviceOrderId_idx" ON "service_order_items"("serviceOrderId");

-- CreateIndex
CREATE INDEX "schedules_serviceOrderId_idx" ON "schedules"("serviceOrderId");

-- CreateIndex
CREATE INDEX "schedules_date_idx" ON "schedules"("date");

-- CreateIndex
CREATE INDEX "equipment_types_name_idx" ON "equipment_types"("name");

-- CreateIndex
CREATE INDEX "equipment_types_category_idx" ON "equipment_types"("category");

-- CreateIndex
CREATE UNIQUE INDEX "equipments_serialNumber_key" ON "equipments"("serialNumber");

-- CreateIndex
CREATE INDEX "equipments_equipmentTypeId_idx" ON "equipments"("equipmentTypeId");

-- CreateIndex
CREATE INDEX "equipments_clientId_idx" ON "equipments"("clientId");

-- CreateIndex
CREATE INDEX "equipments_status_idx" ON "equipments"("status");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_payments" ADD CONSTRAINT "monthly_payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
