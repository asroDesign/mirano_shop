ALTER TABLE products
  ADD COLUMN IF NOT EXISTS organic_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS video_media_id integer;
