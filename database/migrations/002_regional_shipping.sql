ALTER TABLE store_settings
ADD COLUMN shipping_fee_danang DECIMAL(12, 2) NULL AFTER shipping_fee;

UPDATE store_settings
SET shipping_fee_danang = 15000.00
WHERE id = 1 AND shipping_fee_danang IS NULL;
