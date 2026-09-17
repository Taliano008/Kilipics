-- Consumer-submitted "Check availability" requests from
-- app/booking/[providerId].tsx. Deliberately a separate table from
-- `bookings` (a merchant-created manual appointment has an exact time and
-- duration decided; a consumer's availability request only has a preferred
-- date and a fuzzy time-of-day) rather than overloading that table's clean
-- shape with nullable fields for a different concept.
CREATE TABLE IF NOT EXISTS availability_requests (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL,
  service_id       CHAR(26),
  consumer_name    VARCHAR(255) NOT NULL,
  whatsapp_number  VARCHAR(20) NOT NULL,
  preferred_date   DATE NOT NULL,
  preferred_time   ENUM('morning','afternoon','evening','flexible')
                     NOT NULL DEFAULT 'flexible',
  notes            TEXT,
  status           ENUM('new','contacted','closed') NOT NULL DEFAULT 'new',
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                     ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE SET NULL,
  KEY availability_requests_business_idx (business_id, status, created_at)
);
