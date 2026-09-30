-- Remote kill switch (min_version / update_message key-value rows, editable
-- via the admin panel). If no row exists, appConfig is omitted entirely
-- from the catalog response — the mobile client treats a missing field as
-- "no constraint."
CREATE TABLE IF NOT EXISTS app_config (
  key_name   VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE OR REPLACE TRIGGER app_config_set_updated_at
  BEFORE UPDATE ON app_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();
