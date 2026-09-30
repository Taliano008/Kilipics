-- Supabase exposes every table in the public schema through its REST API
-- (PostgREST) to anyone holding the project's publishable/anon key — which
-- ships inside the mobile app. Without RLS that key could read password
-- hashes and bearer-token hashes straight out of users/merchants/*_tokens.
--
-- RLS on with no policies denies the anon and authenticated roles
-- everything. The backend connects as the postgres role (table owner, with
-- BYPASSRLS), so its own queries are unaffected. Every new table added by a
-- future migration needs the same line.
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE services              ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE looks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_uploads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens           ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_requests ENABLE ROW LEVEL SECURITY;
