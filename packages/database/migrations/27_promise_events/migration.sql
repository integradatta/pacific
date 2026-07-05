-- Eventos de promessa na timeline da operação (#4): registro do combinado e do desfecho
-- (cumprida/quebrada) resolvido pelo scheduler. Aditivo e idempotente.
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PROMISE_MADE';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PROMISE_KEPT';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PROMISE_BROKEN';
