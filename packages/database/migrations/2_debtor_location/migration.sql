-- Ponto de extensão INERTE de localização (futuro, voluntário, simulado; sem rastreamento real).
-- Coluna nullable, nunca lida/gravada por código. Aditiva e idempotente.
ALTER TABLE "Debtor" ADD COLUMN IF NOT EXISTS "lastLocation" TEXT;
