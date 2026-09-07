-- Retention: a nightly job (src/jobs/prune-availability.js) deletes rows
-- where date < CURDATE() - 7.
CREATE TABLE IF NOT EXISTS availability (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL,
  service_id       CHAR(26) NOT NULL,
  professional_id  VARCHAR(100) NOT NULL DEFAULT 'default',
  `date`           DATE NOT NULL,
  `time`           TIME NOT NULL,
  end_time         TIME,
  available_slots  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE CASCADE,
  UNIQUE KEY availability_slot_uk
    (business_id, service_id, professional_id, `date`, `time`),
  KEY availability_business_date_idx (business_id, `date`)
);
