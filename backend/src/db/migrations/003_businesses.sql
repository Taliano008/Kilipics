-- One merchant may own one business in Phase Zero — enforced in app code,
-- not a DB constraint (a constraint would make the Phase One multi-business
-- migration harder). starting_price is whole KES, no decimals. cover_url and
-- gallery_urls store local file paths in Phase Zero, CDN URLs after the R2
-- migration. open_now is NOT stored — computed at snapshot build time from
-- hours + current Nairobi time. Enum-like columns are VARCHAR + a named
-- CHECK constraint, so a later migration can widen the allowed set.
CREATE TABLE IF NOT EXISTS businesses (
  id                  CHAR(26) PRIMARY KEY,
  merchant_id         CHAR(26) NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  slug                VARCHAR(255) UNIQUE NOT NULL,
  name                VARCHAR(255) NOT NULL,
  industry            VARCHAR(20) NOT NULL
                        CONSTRAINT businesses_industry_check CHECK (industry IN ('beauty','wellness')),
  category_id         VARCHAR(100) NOT NULL,
  subcategory         VARCHAR(100),
  email               VARCHAR(255),
  phone               VARCHAR(20) NOT NULL,
  area                VARCHAR(255) NOT NULL,
  full_address        TEXT NOT NULL,
  latitude            DOUBLE PRECISION NOT NULL,
  longitude           DOUBLE PRECISION NOT NULL,
  location_type       VARCHAR(20) NOT NULL DEFAULT 'FIXED_VENUE'
                        CONSTRAINT businesses_location_type_check
                        CHECK (location_type IN ('FIXED_VENUE','MOBILE_SERVICE','BOTH')),
  service_areas       JSONB NOT NULL DEFAULT '[]',
  landmark            VARCHAR(255) NOT NULL DEFAULT '',
  parking_available   SMALLINT NOT NULL DEFAULT 0,
  hours               TEXT NOT NULL DEFAULT '',
  highlights          JSONB NOT NULL DEFAULT '[]',
  facilities          JSONB NOT NULL DEFAULT '[]',
  main_offering       VARCHAR(255) NOT NULL DEFAULT '',
  positioning         TEXT,
  starting_price      INTEGER CHECK (starting_price >= 0),
  rating              NUMERIC(3,2),
  verified_count      INTEGER NOT NULL DEFAULT 0 CHECK (verified_count >= 0),
  would_return        NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  trust_metric        VARCHAR(255) NOT NULL DEFAULT '',
  verified            SMALLINT NOT NULL DEFAULT 0,
  recommended         SMALLINT NOT NULL DEFAULT 0,
  featured            SMALLINT NOT NULL DEFAULT 0,
  booking_enabled     SMALLINT NOT NULL DEFAULT 0,
  booking_method      VARCHAR(20) NOT NULL DEFAULT 'disabled'
                        CONSTRAINT businesses_booking_method_check
                        CHECK (booking_method IN ('kilipicks','whatsapp','phone','external','disabled')),
  partnership_status  VARCHAR(20) NOT NULL DEFAULT 'unsigned'
                        CONSTRAINT businesses_partnership_status_check
                        CHECK (partnership_status IN ('signed','unsigned')),
  publication_status  VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CONSTRAINT businesses_publication_status_check
                        CHECK (publication_status IN ('draft','published','hidden','archived')),
  limited_listing     SMALLINT NOT NULL DEFAULT 1,
  cover_url           TEXT,
  gallery_urls        JSONB NOT NULL DEFAULT '[]',
  public_contacts     JSONB NOT NULL DEFAULT '{}',
  payment_settings    JSONB NOT NULL DEFAULT '{}',
  next_available      VARCHAR(100),
  created_at          TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at          TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE OR REPLACE TRIGGER businesses_set_updated_at
  BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS businesses_merchant_idx ON businesses (merchant_id);
CREATE INDEX IF NOT EXISTS businesses_status_idx ON businesses (publication_status, limited_listing);
CREATE INDEX IF NOT EXISTS businesses_category_idx ON businesses (category_id);
