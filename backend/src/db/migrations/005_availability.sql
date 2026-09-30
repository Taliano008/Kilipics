-- Retention: a nightly job (src/jobs/prune-availability.js) deletes rows
-- where date < CURRENT_DATE - 7.
CREATE TABLE IF NOT EXISTS availability (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id       CHAR(26) NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  professional_id  VARCHAR(100) NOT NULL DEFAULT 'default',
  "date"           DATE NOT NULL,
  "time"           TIME(0) NOT NULL,
  end_time         TIME(0),
  available_slots  SMALLINT NOT NULL DEFAULT 1 CHECK (available_slots BETWEEN 0 AND 255),
  created_at       TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT availability_slot_uk
    UNIQUE (business_id, service_id, professional_id, "date", "time")
);

CREATE INDEX IF NOT EXISTS availability_business_date_idx ON availability (business_id, "date");
