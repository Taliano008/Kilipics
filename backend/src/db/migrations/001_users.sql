-- Consumers (Phase One login). Table created now so the schema is ready;
-- no login endpoints are built for users in Phase Zero.
CREATE TABLE IF NOT EXISTS users (
  id           CHAR(26) PRIMARY KEY,
  email        VARCHAR(255) UNIQUE NOT NULL,
  phone        VARCHAR(20),
  full_name    VARCHAR(255),
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                 ON UPDATE CURRENT_TIMESTAMP(3)
);
