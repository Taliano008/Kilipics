ALTER TABLE services
ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER business_id;
