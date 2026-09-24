-- =====================================================================
-- ZEVO v3 — Lote 6: índices para as consultas mais frequentes
-- Somente cria índices. Nenhum dado é alterado.
-- =====================================================================

-- Financeiro/alertas: "pendentes vencidos" e job de atraso
CREATE INDEX "monthly_payments_status_dueDate_idx" ON "monthly_payments"("status", "dueDate");

-- Dashboard/alertas: OS em aberto por prioridade (ex.: urgentes)
CREATE INDEX "service_orders_status_priority_idx" ON "service_orders"("status", "priority");

-- Página do cliente e relatório: OS de um cliente em ordem de abertura
CREATE INDEX "service_orders_clientId_createdAt_idx" ON "service_orders"("clientId", "createdAt");

-- Relatório: instalações e retiradas no mês
CREATE INDEX "equipment_movements_type_createdAt_idx" ON "equipment_movements"("type", "createdAt");
