-- ── #4 Lixeira: soft-delete de operações (restaurável por 30 dias) ────────────────────────────
-- Excluir passa a marcar deletedAt em vez de apagar; um job depura as antigas. TODA leitura de
-- carteira/dashboard/devedor passa a filtrar deletedAt = null.
ALTER TABLE "Debt" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Debt_tenantId_deletedAt_idx" ON "Debt"("tenantId", "deletedAt");
