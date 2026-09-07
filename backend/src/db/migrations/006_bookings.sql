CREATE TABLE IF NOT EXISTS bookings (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL,
  service_id       CHAR(26),
  customer_name    VARCHAR(255) NOT NULL,
  customer_phone   VARCHAR(20) NOT NULL,
  `date`           DATE NOT NULL,
  `time`           TIME NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  `status`         ENUM('pending','confirmed','cancelled','completed')
                     NOT NULL DEFAULT 'pending',
  notes            TEXT,
  source           ENUM('manual','app') NOT NULL DEFAULT 'manual',
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                     ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE SET NULL,
  KEY bookings_business_date_idx (business_id, `date`)
);
