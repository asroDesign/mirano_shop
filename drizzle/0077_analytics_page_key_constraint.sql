ALTER TABLE analytics_events
  DROP CONSTRAINT IF EXISTS analytics_events_page_key_check;

ALTER TABLE analytics_events
  ADD CONSTRAINT analytics_events_page_key_check
  CHECK (
    page_key IN ('home', 'shop', 'product', 'blog', 'cart')
    OR page_key ~ '^(home|shop|product|blog|cart):[0-9a-f]{64}$'
  );
