-- Listing review, as the admin panel works it.
--
-- publication_status says whether a business is live. It can't say where a
-- business that ISN'T live stands: never submitted, waiting for an admin,
-- or sent back for changes all look the same ('draft'). review_status
-- carries that, which gives the panel an "awaiting review" filter and
-- gives the merchant an answer. review_note is the admin's message to the
-- merchant when changes are requested.
ALTER TABLE businesses
  ADD COLUMN review_status VARCHAR(20) NOT NULL DEFAULT 'not_submitted'
    CONSTRAINT businesses_review_status_check
    CHECK (review_status IN ('not_submitted','awaiting_review','changes_requested','approved')),
  ADD COLUMN review_note TEXT,
  ADD COLUMN reviewed_at TIMESTAMP(3);

UPDATE businesses
SET review_status = CASE
  WHEN publication_status = 'published' THEN 'approved'
  WHEN submitted_at IS NOT NULL THEN 'awaiting_review'
  ELSE 'not_submitted'
END;

CREATE INDEX IF NOT EXISTS businesses_review_idx ON businesses (review_status, submitted_at);

-- Customer accounts can be suspended from the admin panel, the same way
-- merchant accounts already can (002_merchants.sql).
ALTER TABLE users
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
    CONSTRAINT users_status_check CHECK (status IN ('active','suspended'));
