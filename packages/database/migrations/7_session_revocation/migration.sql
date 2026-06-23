-- Force-logout instantâneo + captura de erros. Aditivo e idempotente.

-- Denylist de sessões: tokens com iat < revokedAfter são rejeitados nos guards.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "revokedAfter" TIMESTAMP(3);

-- Novo tipo de evento p/ erros do servidor (monitoramento).
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'ERROR';
