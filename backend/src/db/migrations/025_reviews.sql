-- Consumer-written reviews. One review per consumer per business — writing
-- again edits it. status lets an admin hide a review from the AdminJS panel
-- without deleting it. businesses.rating / verified_count are recomputed
-- from the published rows whenever a review is written (see
-- services/reviews.js), so the catalog keeps reading them as before.
CREATE TABLE IF NOT EXISTS reviews (
  id           CHAR(26) PRIMARY KEY,
  business_id  CHAR(26) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id      CHAR(26) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT NOT NULL DEFAULT '',
  status       VARCHAR(20) NOT NULL DEFAULT 'published'
                 CONSTRAINT reviews_status_check CHECK (status IN ('published','hidden')),
  created_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT reviews_business_user_uk UNIQUE (business_id, user_id)
);

CREATE OR REPLACE TRIGGER reviews_set_updated_at
  BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS reviews_business_created_idx ON reviews (business_id, created_at DESC);

-- Same reason as 022_enable_row_level_security.sql.
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
