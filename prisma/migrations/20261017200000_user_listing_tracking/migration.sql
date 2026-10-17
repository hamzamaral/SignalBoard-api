-- AlterTable
ALTER TABLE "user_listings" ADD COLUMN IF NOT EXISTS "apply_channel" TEXT;
ALTER TABLE "user_listings" ADD COLUMN IF NOT EXISTS "mail_ok" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_listings" ADD COLUMN IF NOT EXISTS "form_ok" BOOLEAN NOT NULL DEFAULT false;
