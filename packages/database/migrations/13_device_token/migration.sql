-- Token de push do dispositivo do sobrinho (registro; envio FCM é externo). Aditivo/idempotente.
CREATE TABLE IF NOT EXISTS "DeviceToken" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "debtorId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_token_key" ON "DeviceToken" ("token");
CREATE INDEX IF NOT EXISTS "DeviceToken_tenantId_debtorId_idx" ON "DeviceToken" ("tenantId", "debtorId");
