-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Event"
ADD COLUMN "calendarId" TEXT,
ADD COLUMN "parentEventId" TEXT,
ADD COLUMN "originalOccurrenceStart" TIMESTAMP(3),
ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "location" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "color" TEXT,
ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN "workingLocationLabel" TEXT,
ADD COLUMN "timezone" TEXT,
ADD COLUMN "recurrenceRule" TEXT,
ADD COLUMN "recurrenceUntil" TIMESTAMP(3),
ADD COLUMN "recurrenceCount" INTEGER,
ADD COLUMN "exdates" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[];

-- CreateTable
CREATE TABLE "EventReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "minutesBefore" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReminder_pkey" PRIMARY KEY ("id")
);

-- Backfill a default calendar for users
INSERT INTO "Calendar" ("id", "userId", "name", "color", "createdAt", "updatedAt")
SELECT
    'cal_' || substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24),
    "id",
    'Personal',
    '#3b82f6',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
WHERE NOT EXISTS (
    SELECT 1 FROM "Calendar" c WHERE c."userId" = "User"."id"
);

-- Backfill event calendarId
UPDATE "Event" e
SET "calendarId" = c."id"
FROM LATERAL (
    SELECT "id"
    FROM "Calendar"
    WHERE "userId" = e."userId"
    ORDER BY "createdAt" ASC
    LIMIT 1
) c
WHERE e."calendarId" IS NULL;

ALTER TABLE "Event"
ALTER COLUMN "calendarId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Calendar_userId_createdAt_idx" ON "Calendar"("userId", "createdAt");
CREATE INDEX "Event_calendarId_startAt_idx" ON "Event"("calendarId", "startAt");
CREATE INDEX "Event_parentEventId_idx" ON "Event"("parentEventId");
CREATE INDEX "EventReminder_userId_firedAt_method_idx" ON "EventReminder"("userId", "firedAt", "method");
CREATE INDEX "EventReminder_eventId_minutesBefore_idx" ON "EventReminder"("eventId", "minutesBefore");

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_parentEventId_fkey" FOREIGN KEY ("parentEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
