CREATE TABLE IF NOT EXISTS looks (
  id           CHAR(26) PRIMARY KEY,
  business_id  CHAR(26) NOT NULL,
  media_urls   JSON NOT NULL,
  media_type   ENUM('photos','video') NOT NULL,
  categories   JSON NOT NULL DEFAULT ('[]'),
  service_id   CHAR(26),
  description  VARCHAR(100) NOT NULL DEFAULT '',
  tags         JSON NOT NULL DEFAULT ('[]'),
  `status`     ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                 ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE SET NULL,
  KEY looks_business_idx (business_id, `status`)
);
