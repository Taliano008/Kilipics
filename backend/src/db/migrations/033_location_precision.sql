-- How much to trust a business's latitude/longitude:
--   pin     — the merchant placed it on the map (onboarding step 2)
--   address — looked up from the street address; roughly right
--   none    — still the central-Nairobi placeholder written at signup
-- The app shows a map only for pin/address, and labels address ones
-- "approximate".
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS location_precision VARCHAR(10) NOT NULL DEFAULT 'none'
    CONSTRAINT businesses_location_precision_check
    CHECK (location_precision IN ('none', 'address', 'pin'));

-- Anything already away from the placeholder was set deliberately.
UPDATE businesses
   SET location_precision = 'pin'
 WHERE location_precision = 'none'
   AND NOT (latitude = -1.2921 AND longitude = 36.8219);
