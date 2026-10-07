-- Two-step login: after the password, a one-time code is e-mailed; the session is issued once it is confirmed.
-- Additive: existing users need nothing, their next login simply asks for the code.
CREATE TYPE "LoginChallengeStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "login_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" "LoginChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "login_challenges_tokenHash_key" ON "login_challenges"("tokenHash");
CREATE INDEX "login_challenges_userId_status_idx" ON "login_challenges"("userId", "status");
CREATE INDEX "login_challenges_expiresAt_idx" ON "login_challenges"("expiresAt");

ALTER TABLE "login_challenges" ADD CONSTRAINT "login_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
