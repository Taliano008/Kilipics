-- A small square logo/avatar for the merchant's business card, distinct
-- from cover_url (the hero banner photo on the listing).
ALTER TABLE businesses ADD COLUMN logo_url TEXT NULL AFTER cover_url;
