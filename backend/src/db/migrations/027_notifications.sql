-- In-app notifications for consumers, shown on the app's Notifications
-- screen. Written when a merchant accepts, declines or completes a booking
-- the consumer made while signed in (see services/merchant-bookings.js).
-- These are read by the app when it's opened — there is no push delivery.
CREATE TABLE IF NOT EXISTS notifications (
  id           CHAR(26) PRIMARY KEY,
  user_id      CHAR(26) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(40) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  booking_id   CHAR(26) REFERENCES bookings(id) ON DELETE SET NULL,
  business_id  CHAR(26) REFERENCES businesses(id) ON DELETE SET NULL,
  read_at      TIMESTAMP(3),
  created_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

-- Same reason as 022_enable_row_level_security.sql.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
