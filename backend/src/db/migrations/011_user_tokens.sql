-- Consumer bearer tokens. Structurally identical to merchant_tokens
-- (002_merchants.sql) by design — two separate auth systems, same shape,
-- never the same table.
CREATE TABLE IF NOT EXISTS user_tokens (
  id           CHAR(26) PRIMARY KEY,
  user_id      CHAR(26) NOT NULL,
  token_hash   VARCHAR(64) NOT NULL UNIQUE,
  expires_at   DATETIME(3) NOT NULL,
  last_used_at DATETIME(3),
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY user_tokens_user_idx (user_id)
);
