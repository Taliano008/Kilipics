-- Adds "logo" to the set of purposes a merchant photo upload can be tagged
-- with (see media_uploads.purpose and ALLOWED_PURPOSES in merchant-media.js).
ALTER TABLE media_uploads DROP CONSTRAINT media_uploads_purpose_check;
ALTER TABLE media_uploads ADD CONSTRAINT media_uploads_purpose_check
  CHECK (purpose IN ('cover','gallery','look','service','logo'));
