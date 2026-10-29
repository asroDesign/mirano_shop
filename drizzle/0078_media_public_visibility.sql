ALTER TABLE "media"
  ADD COLUMN IF NOT EXISTS "is_public" boolean NOT NULL DEFAULT false;
