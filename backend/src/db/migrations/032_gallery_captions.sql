-- Optional per-photo captions for the Studio & Work Gallery, shown when a
-- customer opens a photo full screen. Keyed by the photo's stored URL (the
-- same string as in gallery_urls) so gallery_urls itself stays a plain
-- string array, which the public catalog schema requires:
--   { "/uploads/abc.jpg": { "title": "Knotless braids", "price": "KES 4,500" } }
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS gallery_captions JSONB NOT NULL DEFAULT '{}';
