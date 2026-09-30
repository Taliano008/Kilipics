CREATE TABLE IF NOT EXISTS merchants (
  id              CHAR(26) PRIMARY KEY,
  full_name       VARCHAR(255) NOT NULL,
  email           CITEXT UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CONSTRAINT merchants_status_check CHECK (status IN ('active','suspended')),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE OR REPLACE TRIGGER merchants_set_updated_at
  BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS merchant_tokens (
  id           CHAR(26) PRIMARY KEY,
  merchant_id  CHAR(26) NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL UNIQUE,
  expires_at   TIMESTAMP(3) NOT NULL,
  last_used_at TIMESTAMP(3),
  created_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS merchant_tokens_merchant_idx ON merchant_tokens (merchant_id);
