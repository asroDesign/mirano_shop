-- Free-shipping thresholds are not a store policy. Carrier charges are based
-- on the configured destination/weight tariff; freight collect remains separate.
ALTER TABLE carriers DROP COLUMN IF EXISTS free_threshold;
