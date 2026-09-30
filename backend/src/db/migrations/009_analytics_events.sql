-- event_id is the dedup key: the mobile client retries on failure, and an
-- insert that conflicts on event_id must succeed silently
-- (ON CONFLICT (event_id) DO NOTHING). Never return an error for a
-- duplicate event.
CREATE TABLE IF NOT EXISTS analytics_events (
  id                      CHAR(26) PRIMARY KEY,
  event_id                VARCHAR(100) NOT NULL,
  anonymous_user_id       VARCHAR(100) NOT NULL,
  session_id              VARCHAR(100) NOT NULL,
  event_name              VARCHAR(100) NOT NULL,
  "timestamp"             TIMESTAMP(3) NOT NULL,
  page_path               VARCHAR(500),
  page_title              VARCHAR(255),
  merchant_id             VARCHAR(100),
  merchant_name           VARCHAR(255),
  category_id             VARCHAR(100),
  category_name           VARCHAR(255),
  search_query            VARCHAR(500),
  source_surface          VARCHAR(100),
  source_section          VARCHAR(100),
  product_version         VARCHAR(50),
  screen_width            INTEGER CHECK (screen_width BETWEEN 0 AND 65535),
  screen_height           INTEGER CHECK (screen_height BETWEEN 0 AND 65535),
  operating_system        VARCHAR(100),
  environment             VARCHAR(50),
  metadata                JSONB,
  received_at             TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT analytics_event_id_uk UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS analytics_event_name_idx ON analytics_events (event_name, "timestamp");
CREATE INDEX IF NOT EXISTS analytics_session_idx ON analytics_events (session_id);
