-- Remote kill switch (min_version / update_message key-value rows, editable
-- via the admin panel). If no row exists, appConfig is omitted entirely
-- from the catalog response — the mobile client treats a missing field as
-- "no constraint."
CREATE TABLE IF NOT EXISTS app_config (
  key_name   VARCHAR(100) PRIMARY KEY,
  `value`    TEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
               ON UPDATE CURRENT_TIMESTAMP(3)
);
