CREATE TABLE IF NOT EXISTS clearance_items (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id integer REFERENCES product_variants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('damaged', 'single')),
  sale_price bigint NOT NULL CHECK (sale_price > 0),
  note text,
  active boolean NOT NULL DEFAULT true,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clearance_items_product_variant_unique
  ON clearance_items (product_id, coalesce(variant_id, 0));
CREATE INDEX IF NOT EXISTS clearance_items_active_created
  ON clearance_items (active, created_at);
