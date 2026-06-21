-- Réguas de alerta automático: novos valores do enum NotificationType (15/7/3/0 dias antes).
-- DUE_SOON e OVERDUE permanecem. ADD VALUE é aditivo e idempotente (IF NOT EXISTS).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DUE_15';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DUE_7';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DUE_3';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DUE_TODAY';
