CREATE TABLE IF NOT EXISTS media_uploads (
  id               CHAR(26) PRIMARY KEY,
  merchant_id      CHAR(26) NOT NULL,
  business_id      CHAR(26),
  file_path        VARCHAR(500) NOT NULL,
  public_url       VARCHAR(500) NOT NULL,
  content_type     VARCHAR(100) NOT NULL,
  size_bytes       INT UNSIGNED NOT NULL,
  purpose          ENUM('cover','gallery','look','service') NOT NULL,
  rights_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
);
