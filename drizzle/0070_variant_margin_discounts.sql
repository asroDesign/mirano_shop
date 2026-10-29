ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS profit_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value bigint NOT NULL DEFAULT 0;
