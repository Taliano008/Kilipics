CREATE TABLE IF NOT EXISTS services (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL,
  category_id      VARCHAR(100) NOT NULL,
  industry         ENUM('beauty','wellness') NOT NULL,
  name             VARCHAR(255) NOT NULL,
  description      TEXT NOT NULL DEFAULT (''),
  price            INT UNSIGNED NOT NULL,
  maximum_price    INT UNSIGNED,
  price_type       ENUM('fixed','from','range','contact_for_price')
                     NOT NULL DEFAULT 'fixed',
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  booking_enabled  TINYINT(1) NOT NULL DEFAULT 0,
  active           TINYINT(1) NOT NULL DEFAULT 1,
  image_url        TEXT,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                     ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  KEY services_business_idx (business_id, active)
);
