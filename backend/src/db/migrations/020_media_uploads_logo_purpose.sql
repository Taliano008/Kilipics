-- Adds "logo" to the set of purposes a merchant photo upload can be tagged
-- with (see media_uploads.purpose and ALLOWED_PURPOSES in merchant-media.js).
ALTER TABLE media_uploads MODIFY COLUMN purpose ENUM('cover','gallery','look','service','logo') NOT NULL;
