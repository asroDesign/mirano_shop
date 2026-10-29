CREATE INDEX IF NOT EXISTS order_items_product_order_idx ON order_items (product_id, order_id);
CREATE INDEX IF NOT EXISTS order_items_order_product_idx ON order_items (order_id, product_id);
