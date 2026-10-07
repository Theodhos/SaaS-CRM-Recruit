-- Per user: sign-in asks for a code sent to their e-mail after the password. Off for every existing account.
ALTER TABLE "users" ADD COLUMN "loginOtpEnabled" BOOLEAN NOT NULL DEFAULT false;
