-- event_id is the dedup key: the mobile client retries on failure, and an
-- insert that conflicts on event_id must succeed silently (INSERT IGNORE).
-- Never return an error for a duplicate event.
CREATE TABLE IF NOT EXISTS analytics_events (
  id                      CHAR(26) PRIMARY KEY,
  event_id                VARCHAR(100) NOT NULL,
  anonymous_user_id       VARCHAR(100) NOT NULL,
  session_id              VARCHAR(100) NOT NULL,
  event_name              VARCHAR(100) NOT NULL,
  `timestamp`             DATETIME(3) NOT NULL,
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
  screen_width            SMALLINT UNSIGNED,
  screen_height           SMALLINT UNSIGNED,
  operating_system        VARCHAR(100),
  environment             VARCHAR(50),
  metadata                JSON,
  received_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY analytics_event_id_uk (event_id),
  KEY analytics_event_name_idx (event_name, `timestamp`),
  KEY analytics_session_idx (session_id)
);
