-- ── #1 Confirmação de pagamento pelo sobrinho (loop de mão dupla) ─────────────────────────────
-- O sobrinho INFORMA um pagamento (PaymentClaim PENDING); o padrinho confirma (vira pagamento de
-- fato) ou recusa. Não move dinheiro — é registro/acordo auditável.

-- Novo valor do enum de eventos (fora de transação que o use; só registramos, não lemos aqui).
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_CLAIMED';

CREATE TYPE "PaymentClaimStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "PaymentClaim" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "debtId" TEXT NOT NULL,
  "debtorId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "note" TEXT,
  "status" "PaymentClaimStatus" NOT NULL DEFAULT 'PENDING',
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentClaim_tenantId_status_idx" ON "PaymentClaim"("tenantId", "status");
CREATE INDEX "PaymentClaim_debtId_idx" ON "PaymentClaim"("debtId");
