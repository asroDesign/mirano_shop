-- Honor the requested backorder selling policy for the four approved products.
-- This is additive to existing inventory and does not rewrite stock quantities.
UPDATE products
SET allow_backorder = true
WHERE id IN (63, 66, 68, 73)
  AND source = 'central'
  AND status IN ('active', 'out_of_stock')
  AND allow_backorder = false;
