-- Índices para escala (consultas ordenadas dentro do tenant). Aditivo e idempotente.
CREATE INDEX IF NOT EXISTS "Debt_tenantId_dueDate_idx" ON "Debt" ("tenantId", "dueDate");
CREATE INDEX IF NOT EXISTS "Notification_tenantId_createdAt_idx" ON "Notification" ("tenantId", "createdAt");
