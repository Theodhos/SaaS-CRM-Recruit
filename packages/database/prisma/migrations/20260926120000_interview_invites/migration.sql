-- Interviews scheduled from a pipeline card: where the meeting link came from, the host link, and the invitation e-mail trail.
ALTER TABLE "interviews"
  ADD COLUMN "timezone" TEXT,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "hostUrl" TEXT,
  ADD COLUMN "inviteSentAt" TIMESTAMP(3),
  ADD COLUMN "inviteSentTo" TEXT;
