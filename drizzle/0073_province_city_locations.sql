ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE seller_offers ADD COLUMN IF NOT EXISTS ship_province text;
ALTER TABLE central_pos_sales ADD COLUMN IF NOT EXISTS shipping_province text;
ALTER TABLE pickup_centers ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE carrier_rates ADD COLUMN IF NOT EXISTS province text;
