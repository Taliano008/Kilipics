CREATE TABLE IF NOT EXISTS bookings (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  service_id       CHAR(26) REFERENCES services(id) ON DELETE SET NULL,
  customer_name    VARCHAR(255) NOT NULL,
  customer_phone   VARCHAR(20) NOT NULL,
  "date"           DATE NOT NULL,
  "time"           TIME(0) NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 0 AND 65535),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CONSTRAINT bookings_status_check
                     CHECK (status IN ('pending','confirmed','cancelled','completed')),
  notes            TEXT,
  source           VARCHAR(20) NOT NULL DEFAULT 'manual'
                     CONSTRAINT bookings_source_check CHECK (source IN ('manual','app')),
  created_at       TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at       TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE OR REPLACE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS bookings_business_date_idx ON bookings (business_id, "date");
