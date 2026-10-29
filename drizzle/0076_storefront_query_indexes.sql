CREATE INDEX IF NOT EXISTS products_status_updated_at_idx
  ON products (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS products_status_created_at_idx
  ON products (status, created_at DESC);

CREATE INDEX IF NOT EXISTS product_variants_product_active_idx
  ON product_variants (product_id, is_active);

CREATE INDEX IF NOT EXISTS seller_offers_product_status_idx
  ON seller_offers (product_id, status, seller_id);
