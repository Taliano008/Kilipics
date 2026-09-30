-- Snapshot the service name and price onto each booking at creation time.
-- service_id is ON DELETE SET NULL and services can be renamed/repriced
-- later, so a JOIN alone would rewrite (or blank out) booking history.
ALTER TABLE bookings
  ADD COLUMN service_name VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN price        INTEGER      NOT NULL DEFAULT 0 CHECK (price >= 0);
