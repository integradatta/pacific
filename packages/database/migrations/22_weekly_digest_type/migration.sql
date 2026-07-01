-- Tipo de notificação do resumo semanal. Aditivo e idempotente.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WEEKLY_DIGEST';
