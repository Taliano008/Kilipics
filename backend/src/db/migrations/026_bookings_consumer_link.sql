-- Bookings made from the consumer app (source = 'app') land in the same
-- table the merchant dashboard already reads, so they show up there
-- straight away. user_id ties a booking to the signed-in consumer who made
-- it (NULL for a merchant's manual entry, or a signed-out consumer) so it
-- can be listed and cancelled from the app's Activity tab.
--
-- A consumer only picks a time of day, not an exact slot. preferred_time
-- keeps that choice; "time" holds a representative start for it until the
-- merchant agrees the real slot with the customer.
ALTER TABLE bookings
  ADD COLUMN user_id        CHAR(26) REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN preferred_time VARCHAR(20)
    CONSTRAINT bookings_preferred_time_check
    CHECK (preferred_time IN ('morning','afternoon','evening','flexible'));

CREATE INDEX IF NOT EXISTS bookings_user_date_idx ON bookings (user_id, "date");
