CREATE TABLE IF NOT EXISTS looks (
  id           CHAR(26) PRIMARY KEY,
  business_id  CHAR(26) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  media_urls   JSONB NOT NULL,
  media_type   VARCHAR(20) NOT NULL
                 CONSTRAINT looks_media_type_check CHECK (media_type IN ('photos','video')),
  categories   JSONB NOT NULL DEFAULT '[]',
  service_id   CHAR(26) REFERENCES services(id) ON DELETE SET NULL,
  description  VARCHAR(100) NOT NULL DEFAULT '',
  tags         JSONB NOT NULL DEFAULT '[]',
  status       VARCHAR(20) NOT NULL DEFAULT 'draft'
                 CONSTRAINT looks_status_check CHECK (status IN ('draft','published','archived')),
  created_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE OR REPLACE TRIGGER looks_set_updated_at
  BEFORE UPDATE ON looks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS looks_business_idx ON looks (business_id, status);
