CREATE TABLE IF NOT EXISTS services (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id      VARCHAR(100) NOT NULL,
  industry         VARCHAR(20) NOT NULL
                     CONSTRAINT services_industry_check CHECK (industry IN ('beauty','wellness')),
  name             VARCHAR(255) NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  price            INTEGER NOT NULL CHECK (price >= 0),
  maximum_price    INTEGER CHECK (maximum_price >= 0),
  price_type       VARCHAR(20) NOT NULL DEFAULT 'fixed'
                     CONSTRAINT services_price_type_check
                     CHECK (price_type IN ('fixed','from','range','contact_for_price')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 0 AND 65535),
  booking_enabled  SMALLINT NOT NULL DEFAULT 0,
  active           SMALLINT NOT NULL DEFAULT 1,
  image_url        TEXT,
  created_at       TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at       TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE OR REPLACE TRIGGER services_set_updated_at
  BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS services_business_idx ON services (business_id, active);
