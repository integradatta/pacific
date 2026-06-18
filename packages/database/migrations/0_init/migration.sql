-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'CREDITOR', 'DEBTOR');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('GREEN', 'YELLOW', 'ORANGE', 'RED');

-- CreateEnum
CREATE TYPE "RatePeriod" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DUE_SOON', 'OVERDUE');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgCode" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debtor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Debtor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "debtorId" TEXT NOT NULL,
    "description" TEXT,
    "principal" DECIMAL(14,2) NOT NULL,
    "rate" DECIMAL(9,6) NOT NULL,
    "ratePeriod" "RatePeriod" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'GREEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "debtorId" TEXT,
    "debtId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtorAccess" (
    "id" TEXT NOT NULL,
    "debtorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtorAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtorLoginEvent" (
    "id" TEXT NOT NULL,
    "debtorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtorLoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_orgCode_key" ON "Tenant"("orgCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Debtor_userId_key" ON "Debtor"("userId");

-- CreateIndex
CREATE INDEX "Debtor_tenantId_idx" ON "Debtor"("tenantId");

-- CreateIndex
CREATE INDEX "Debtor_tenantId_email_idx" ON "Debtor"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Debtor_id_tenantId_key" ON "Debtor"("id", "tenantId");

-- CreateIndex
CREATE INDEX "Debt_tenantId_idx" ON "Debt"("tenantId");

-- CreateIndex
CREATE INDEX "Debt_debtorId_idx" ON "Debt"("debtorId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_debtId_type_key" ON "Notification"("debtId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DebtorAccess_debtorId_key" ON "DebtorAccess"("debtorId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtorAccess_tokenHash_key" ON "DebtorAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "DebtorAccess_tenantId_idx" ON "DebtorAccess"("tenantId");

-- CreateIndex
CREATE INDEX "DebtorLoginEvent_tenantId_idx" ON "DebtorLoginEvent"("tenantId");

-- CreateIndex
CREATE INDEX "DebtorLoginEvent_debtorId_at_idx" ON "DebtorLoginEvent"("debtorId", "at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debtor" ADD CONSTRAINT "Debtor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debtor" ADD CONSTRAINT "Debtor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_debtorId_tenantId_fkey" FOREIGN KEY ("debtorId", "tenantId") REFERENCES "Debtor"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

┌─────────────────────────────────────────────────────────┐
│  Update available 5.22.0 -> 7.8.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
