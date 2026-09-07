CREATE TABLE IF NOT EXISTS merchants (
  id              CHAR(26) PRIMARY KEY,
  full_name       VARCHAR(255) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  status          ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                    ON UPDATE CURRENT_TIMESTAMP(3),
  KEY merchants_email_idx (email)
);

CREATE TABLE IF NOT EXISTS merchant_tokens (
  id           CHAR(26) PRIMARY KEY,
  merchant_id  CHAR(26) NOT NULL,
  token_hash   VARCHAR(64) NOT NULL UNIQUE,
  expires_at   DATETIME(3) NOT NULL,
  last_used_at DATETIME(3),
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  KEY merchant_tokens_merchant_idx (merchant_id)
);
