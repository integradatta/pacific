-- Preferência do padrinho por resumo semanal (push). Null = ainda não decidiu. Aditivo.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "weeklyDigestOptIn" BOOLEAN;
