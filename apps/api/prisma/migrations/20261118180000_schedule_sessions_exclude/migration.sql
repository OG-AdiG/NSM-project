-- CreateEnum values already exist: SessionStatus, SessionType

-- CreateTable
CREATE TABLE "WeeklyAvailability" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,

    CONSTRAINT "WeeklyAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArtistAbsence" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistAbsence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TattooSession" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT,
    "artistId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "type" "SessionType" NOT NULL DEFAULT 'SESSION',
    "status" "SessionStatus" NOT NULL DEFAULT 'AWAITING_DEPOSIT',
    "sessionIndex" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TattooSession_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "WeeklyAvailability_artistId_weekday_idx" ON "WeeklyAvailability"("artistId", "weekday");
CREATE UNIQUE INDEX "WeeklyAvailability_artistId_weekday_startMin_endMin_key" ON "WeeklyAvailability"("artistId", "weekday", "startMin", "endMin");
CREATE INDEX "ArtistAbsence_artistId_startsAt_endsAt_idx" ON "ArtistAbsence"("artistId", "startsAt", "endsAt");
CREATE INDEX "TattooSession_artistId_startsAt_idx" ON "TattooSession"("artistId", "startsAt");
CREATE INDEX "TattooSession_clientId_startsAt_idx" ON "TattooSession"("clientId", "startsAt");
CREATE INDEX "TattooSession_submissionId_sessionIndex_idx" ON "TattooSession"("submissionId", "sessionIndex");
CREATE INDEX "TattooSession_status_idx" ON "TattooSession"("status");

-- FKs
ALTER TABLE "WeeklyAvailability" ADD CONSTRAINT "WeeklyAvailability_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArtistAbsence" ADD CONSTRAINT "ArtistAbsence_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TattooSession" ADD CONSTRAINT "TattooSession_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TattooSession" ADD CONSTRAINT "TattooSession_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TattooSession" ADD CONSTRAINT "TattooSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FR-15 / NFR-08: brak kolizji aktywnych sesji tego samego artysty
-- tsrange (nie tstzrange) — kolumny to TIMESTAMP bez strefy
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "TattooSession"
  ADD CONSTRAINT "TattooSession_no_overlap_per_artist"
  EXCLUDE USING gist (
    "artistId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" IN ('AWAITING_DEPOSIT', 'CONFIRMED'));
