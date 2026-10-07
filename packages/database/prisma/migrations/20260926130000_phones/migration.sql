-- Phones: calling lists imported from Excel/CSV, calls placed from the browser, per-phone call history.

-- CreateEnum
CREATE TYPE "PhoneStatus" AS ENUM ('READY', 'DO_NOT_CALL');
CREATE TYPE "PhoneCallDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "PhoneCallStatus" AS ENUM ('INITIATED', 'RINGING', 'ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'REJECTED', 'ENDED');
CREATE TYPE "PhoneImportStatus" AS ENUM ('PREVIEW', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "phone_imports" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "defaultCountry" TEXT NOT NULL,
    "status" "PhoneImportStatus" NOT NULL DEFAULT 'PREVIEW',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "phone_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phones" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "source" TEXT,
    "status" "PhoneStatus" NOT NULL DEFAULT 'READY',
    "lastCallAt" TIMESTAMP(3),
    "lastCallStatus" "PhoneCallStatus",
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "candidateId" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "importId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_calls" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "phoneId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCallId" TEXT,
    "direction" "PhoneCallDirection" NOT NULL DEFAULT 'OUTBOUND',
    "status" "PhoneCallStatus" NOT NULL DEFAULT 'INITIATED',
    "startedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "notes" TEXT,
    "lastEventSeq" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_imports_organisationId_createdAt_idx" ON "phone_imports"("organisationId", "createdAt");
CREATE UNIQUE INDEX "phones_organisationId_normalizedPhone_key" ON "phones"("organisationId", "normalizedPhone");
CREATE INDEX "phones_organisationId_lastCallStatus_idx" ON "phones"("organisationId", "lastCallStatus");
CREATE INDEX "phones_organisationId_createdAt_idx" ON "phones"("organisationId", "createdAt");
CREATE INDEX "phones_ownerId_idx" ON "phones"("ownerId");
CREATE UNIQUE INDEX "phone_calls_providerCallId_key" ON "phone_calls"("providerCallId");
CREATE INDEX "phone_calls_organisationId_idx" ON "phone_calls"("organisationId");
CREATE INDEX "phone_calls_phoneId_createdAt_idx" ON "phone_calls"("phoneId", "createdAt");

-- AddForeignKey
ALTER TABLE "phone_imports" ADD CONSTRAINT "phone_imports_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phone_imports" ADD CONSTRAINT "phone_imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "phones" ADD CONSTRAINT "phones_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phones" ADD CONSTRAINT "phones_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phones" ADD CONSTRAINT "phones_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phones" ADD CONSTRAINT "phones_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phones" ADD CONSTRAINT "phones_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phones" ADD CONSTRAINT "phones_importId_fkey" FOREIGN KEY ("importId") REFERENCES "phone_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phone_calls" ADD CONSTRAINT "phone_calls_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phone_calls" ADD CONSTRAINT "phone_calls_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "phones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phone_calls" ADD CONSTRAINT "phone_calls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
