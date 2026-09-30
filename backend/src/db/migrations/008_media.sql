CREATE TABLE IF NOT EXISTS media_uploads (
  id               CHAR(26) PRIMARY KEY,
  merchant_id      CHAR(26) NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  business_id      CHAR(26) REFERENCES businesses(id) ON DELETE SET NULL,
  file_path        VARCHAR(500) NOT NULL,
  public_url       VARCHAR(500) NOT NULL,
  content_type     VARCHAR(100) NOT NULL,
  size_bytes       INTEGER NOT NULL CHECK (size_bytes >= 0),
  purpose          VARCHAR(20) NOT NULL
                     CONSTRAINT media_uploads_purpose_check
                     CHECK (purpose IN ('cover','gallery','look','service')),
  rights_confirmed SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);
