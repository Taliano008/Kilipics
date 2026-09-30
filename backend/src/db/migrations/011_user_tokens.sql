-- Consumer bearer tokens. Structurally identical to merchant_tokens
-- (002_merchants.sql) by design — two separate auth systems, same shape,
-- never the same table.
CREATE TABLE IF NOT EXISTS user_tokens (
  id           CHAR(26) PRIMARY KEY,
  user_id      CHAR(26) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL UNIQUE,
  expires_at   TIMESTAMP(3) NOT NULL,
  last_used_at TIMESTAMP(3),
  created_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS user_tokens_user_idx ON user_tokens (user_id);
