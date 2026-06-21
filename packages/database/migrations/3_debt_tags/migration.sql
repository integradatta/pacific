-- Etiquetas livres por operação (Debt.tags). Coluna aditiva e idempotente:
-- text[] NOT NULL com default vazio, então registros antigos ficam com '{}'.
ALTER TABLE "Debt" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}'::text[];
