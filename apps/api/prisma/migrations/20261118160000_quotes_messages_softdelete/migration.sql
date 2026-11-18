-- AlterTable
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "quoteNote" TEXT;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Submission_deletedAt_idx" ON "Submission"("deletedAt");
CREATE INDEX IF NOT EXISTS "Submission_preferredArtistId_status_idx" ON "Submission"("preferredArtistId", "status");

-- CreateTable
CREATE TABLE IF NOT EXISTS "SubmissionMessage" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubmissionMessage_submissionId_createdAt_idx" ON "SubmissionMessage"("submissionId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubmissionMessage_authorId_idx" ON "SubmissionMessage"("authorId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SubmissionMessage" ADD CONSTRAINT "SubmissionMessage_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SubmissionMessage" ADD CONSTRAINT "SubmissionMessage_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
