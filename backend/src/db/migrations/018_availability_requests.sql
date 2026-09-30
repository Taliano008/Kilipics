-- Consumer-submitted "Check availability" requests from
-- app/booking/[providerId].tsx. Deliberately a separate table from
-- `bookings` (a merchant-created manual appointment has an exact time and
-- duration decided; a consumer's availability request only has a preferred
-- date and a fuzzy time-of-day) rather than overloading that table's clean
-- shape with nullable fields for a different concept.
CREATE TABLE IF NOT EXISTS availability_requests (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id       CHAR(26) REFERENCES services(id) ON DELETE SET NULL,
  consumer_name    VARCHAR(255) NOT NULL,
  whatsapp_number  VARCHAR(20) NOT NULL,
  preferred_date   DATE NOT NULL,
  preferred_time   VARCHAR(20) NOT NULL DEFAULT 'flexible'
                     CONSTRAINT availability_requests_preferred_time_check
                     CHECK (preferred_time IN ('morning','afternoon','evening','flexible')),
  notes            TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'new'
                     CONSTRAINT availability_requests_status_check
                     CHECK (status IN ('new','contacted','closed')),
  created_at       TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at       TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE OR REPLACE TRIGGER availability_requests_set_updated_at
  BEFORE UPDATE ON availability_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS availability_requests_business_idx
  ON availability_requests (business_id, status, created_at);
