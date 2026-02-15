ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

UPDATE "User"
SET
  "firstName" = COALESCE(
    NULLIF(SPLIT_PART(BTRIM(COALESCE("name", '')), ' ', 1), ''),
    NULLIF(SPLIT_PART(COALESCE("email", ''), '@', 1), ''),
    "username"
  ),
  "lastName" = COALESCE(
    NULLIF(
      BTRIM(
        SUBSTRING(
          BTRIM(COALESCE("name", ''))
          FROM LENGTH(SPLIT_PART(BTRIM(COALESCE("name", '')), ' ', 1)) + 1
        )
      ),
      ''
    ),
    ''
  )
WHERE "firstName" IS NULL OR "lastName" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "firstName" SET DEFAULT '',
ALTER COLUMN "lastName" SET DEFAULT '';

ALTER TABLE "User"
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;
