-- Notificação de saída de cerca (geofence): o padrinho é avisado quando o sobrinho sai de uma área.
-- Aditivo e idempotente. Aplicar ANTES do deploy (o código passa a gravar esse tipo de notificação).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GEOFENCE_EXIT';
