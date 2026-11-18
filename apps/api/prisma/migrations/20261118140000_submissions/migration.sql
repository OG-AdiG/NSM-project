-- CreateEnum
CREATE TYPE "ColorMode" AS ENUM ('BLACK_GREY', 'COLOR');

-- CreateTable
CREATE TABLE "ArtistProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "styles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "preferredArtistId" TEXT,
    "description" TEXT NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "colorMode" "ColorMode" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'NEW',
    "estimateMinPln" INTEGER,
    "estimateMaxPln" INTEGER,
    "finalPricePln" INTEGER,
    "sessionCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferencePhoto" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferencePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtistProfile_userId_key" ON "ArtistProfile"("userId");

-- CreateIndex
CREATE INDEX "Submission_clientId_idx" ON "Submission"("clientId");

-- CreateIndex
CREATE INDEX "Submission_preferredArtistId_idx" ON "Submission"("preferredArtistId");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "ReferencePhoto_submissionId_idx" ON "ReferencePhoto"("submissionId");

-- AddForeignKey
ALTER TABLE "ArtistProfile" ADD CONSTRAINT "ArtistProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_preferredArtistId_fkey" FOREIGN KEY ("preferredArtistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferencePhoto" ADD CONSTRAINT "ReferencePhoto_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
