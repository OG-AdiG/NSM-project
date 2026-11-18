-- AlterTable
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "preferredDate" TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "preferredSlotStart" TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "preferredSlotEnd" TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "preferredTimeNote" TEXT;
