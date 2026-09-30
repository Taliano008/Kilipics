-- Postgres (Supabase). Timestamps are TIMESTAMP(3) holding UTC wall-clock
-- time — the defaults use now() AT TIME ZONE 'utc' so that holds no matter
-- what the session time zone is. updated_at is kept current by the
-- set_updated_at() trigger (Postgres has no ON UPDATE CURRENT_TIMESTAMP).
-- Emails are CITEXT: MySQL's default collation compared them
-- case-insensitively, and the auth lookups (WHERE email = ?) rely on that.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now() AT TIME ZONE 'utc';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Consumers (Phase One login). Table created now so the schema is ready;
-- no login endpoints are built for users in Phase Zero.
CREATE TABLE IF NOT EXISTS users (
  id           CHAR(26) PRIMARY KEY,
  email        CITEXT UNIQUE NOT NULL,
  phone        VARCHAR(20),
  full_name    VARCHAR(255),
  created_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at   TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE OR REPLACE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
