-- Régua de alerta "vence amanhã" (1 dia antes). Aditivo e idempotente.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DUE_1';
