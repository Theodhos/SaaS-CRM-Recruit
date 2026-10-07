-- The CRM pages each user works with, chosen by the admin. Empty = all of them (every existing user).
ALTER TABLE "users" ADD COLUMN "allowedSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
