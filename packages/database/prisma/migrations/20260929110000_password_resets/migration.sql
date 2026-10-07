-- "Forgot password": a link to choose a new one is e-mailed (passwords are stored as bcrypt hashes and cannot be sent back).
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_resets_tokenHash_key" ON "password_resets"("tokenHash");
CREATE INDEX "password_resets_userId_idx" ON "password_resets"("userId");
CREATE INDEX "password_resets_expiresAt_idx" ON "password_resets"("expiresAt");

ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
