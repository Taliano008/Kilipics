-- One merchant may own one business in Phase Zero — enforced in app code,
-- not a DB constraint (a constraint would make the Phase One multi-business
-- migration harder). starting_price is whole KES, no decimals. cover_url and
-- gallery_urls store local file paths in Phase Zero, CDN URLs after the R2
-- migration. open_now is NOT stored — computed at snapshot build time from
-- hours + current Nairobi time.
CREATE TABLE IF NOT EXISTS businesses (
  id                  CHAR(26) PRIMARY KEY,
  merchant_id         CHAR(26) NOT NULL,
  slug                VARCHAR(255) UNIQUE NOT NULL,
  name                VARCHAR(255) NOT NULL,
  industry            ENUM('beauty','wellness') NOT NULL,
  category_id         VARCHAR(100) NOT NULL,
  subcategory         VARCHAR(100),
  email               VARCHAR(255),
  phone               VARCHAR(20) NOT NULL,
  area                VARCHAR(255) NOT NULL,
  full_address        TEXT NOT NULL,
  latitude            DOUBLE NOT NULL,
  longitude           DOUBLE NOT NULL,
  location_type       ENUM('FIXED_VENUE','MOBILE_SERVICE','BOTH')
                        NOT NULL DEFAULT 'FIXED_VENUE',
  service_areas       JSON NOT NULL DEFAULT ('[]'),
  landmark            VARCHAR(255) NOT NULL DEFAULT '',
  parking_available   TINYINT(1) NOT NULL DEFAULT 0,
  hours               TEXT NOT NULL DEFAULT (''),
  highlights          JSON NOT NULL DEFAULT ('[]'),
  facilities          JSON NOT NULL DEFAULT ('[]'),
  main_offering       VARCHAR(255) NOT NULL DEFAULT '',
  positioning         TEXT,
  starting_price      INT UNSIGNED,
  rating              DECIMAL(3,2),
  verified_count      INT UNSIGNED NOT NULL DEFAULT 0,
  would_return        DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  trust_metric        VARCHAR(255) NOT NULL DEFAULT '',
  verified            TINYINT(1) NOT NULL DEFAULT 0,
  recommended         TINYINT(1) NOT NULL DEFAULT 0,
  featured            TINYINT(1) NOT NULL DEFAULT 0,
  booking_enabled     TINYINT(1) NOT NULL DEFAULT 0,
  booking_method      ENUM('kilipicks','whatsapp','phone','external','disabled')
                        NOT NULL DEFAULT 'disabled',
  partnership_status  ENUM('signed','unsigned') NOT NULL DEFAULT 'unsigned',
  publication_status  ENUM('draft','published','hidden','archived')
                        NOT NULL DEFAULT 'draft',
  limited_listing     TINYINT(1) NOT NULL DEFAULT 1,
  cover_url           TEXT,
  gallery_urls        JSON NOT NULL DEFAULT ('[]'),
  public_contacts     JSON NOT NULL DEFAULT ('{}'),
  payment_settings    JSON NOT NULL DEFAULT ('{}'),
  next_available      VARCHAR(100),
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE RESTRICT,
  KEY businesses_merchant_idx (merchant_id),
  KEY businesses_status_idx (publication_status, limited_listing),
  KEY businesses_category_idx (category_id)
);
