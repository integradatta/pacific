-- Pagamentos por operação: total abatido (paidAmount) e quitação (settledAt).
-- Colunas aditivas e idempotentes; registros antigos ficam com paidAmount=0 e settledAt nulo.
ALTER TABLE "Debt" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Debt" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);
