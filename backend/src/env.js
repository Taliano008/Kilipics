import "dotenv/config";
import path from "node:path";

const PLACEHOLDER_VALUES = new Set([
  "change-this-to-a-long-random-string-before-any-real-use",
  "change-this-before-use",
  "change-this-to-a-long-random-string",
]);

export const env = Object.freeze({
  port: Number(process.env.PORT) || 3000,
  // Runs as its own Fastify instance/process (see src/admin/server.js), not
  // mounted into the main API — @adminjs/fastify's session/cookie/formbody
  // plugins are Fastify-5-only, while the main app is still on Fastify 4,
  // and (separately) its own bundled multipart plugin collides with the
  // main app's if both are registered on one instance. Keeping it a
  // separate process sidesteps both problems entirely.
  adminPort: Number(process.env.ADMIN_PORT) || 3050,
  nodeEnv: process.env.NODE_ENV || "development",

  // Supabase Postgres connection string (Project Settings -> Database ->
  // Connection string, "Session pooler"). TLS is on unless DATABASE_SSL=false,
  // which only makes sense against a local Postgres.
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: process.env.DATABASE_SSL !== "false",

  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "90d",

  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",

  analyticsAppToken: process.env.ANALYTICS_APP_TOKEN || "",

  // How many reverse proxies sit in front of this server (a load balancer,
  // the host's router, a CDN). Rate limiting keys on the client's IP; behind
  // a proxy the socket address is the proxy's, so without this every user
  // shares one bucket and a busy minute locks everyone out of logging in.
  // Must be the real hop count and no more: each trusted hop is a position
  // in X-Forwarded-For the server will believe, and a client can write
  // anything into that header. 0 (the default) trusts none — right for
  // running directly on a machine, e.g. local development.
  trustProxyHops: Math.max(0, Math.floor(Number(process.env.TRUST_PROXY_HOPS)) || 0),

  // Comma-separated browser origins allowed to call the API (see the cors
  // registration in app.js). Empty means none in production.
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Supabase Storage for uploaded photos. When all three are set, uploads
  // go to the bucket (which must be public) and survive redeploys; when
  // not, they fall back to uploadsDir on local disk — fine for development,
  // not for a host with an ephemeral filesystem. The service-role key is
  // server-only: it bypasses row-level security and must never ship in the
  // app. See lib/storage.js.
  supabaseUrl: (process.env.SUPABASE_URL || "").replace(/\/$/, ""),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || "",

  uploadsDir: path.resolve(process.cwd(), process.env.UPLOADS_DIR || "./uploads"),
  // Prefix for stored photo URLs. The default is a path relative to this
  // server, so stored URLs don't bake in whatever IP/host the server had at
  // upload time — the mobile app resolves them against the backend address
  // it's using (resolveMediaUrl in src/config/env.ts). Only set a full URL
  // for a CDN or other host that serves the files.
  uploadsBaseUrl: (process.env.UPLOADS_BASE_URL || "/uploads").replace(/\/$/, ""),
});

// Fails fast and loudly rather than booting a server whose admin password is
// a placeholder published in a spec document, or whose JWT_SECRET is too
// short for AdminJS's cookiePassword requirement (>= 32 chars).
export function assertEnv() {
  const problems = [];

  const required = {
    JWT_SECRET: env.jwtSecret,
    ADMIN_EMAIL: env.adminEmail,
    ADMIN_PASSWORD: env.adminPassword,
    ANALYTICS_APP_TOKEN: env.analyticsAppToken,
    DATABASE_URL: env.databaseUrl,
  };
  for (const [key, value] of Object.entries(required)) {
    if (!value) problems.push(`${key} is missing. Copy .env.example to .env and fill it in (run "npm run init:env" to generate secrets).`);
  }

  for (const [key, value] of Object.entries({
    JWT_SECRET: env.jwtSecret,
    ADMIN_PASSWORD: env.adminPassword,
    ANALYTICS_APP_TOKEN: env.analyticsAppToken,
  })) {
    if (PLACEHOLDER_VALUES.has(value)) {
      problems.push(`${key} is still the placeholder value from .env.example. Run "npm run init:env" to generate a real one.`);
    }
  }

  if (env.databaseUrl.includes("[YOUR-PASSWORD]")) {
    problems.push("DATABASE_URL still contains [YOUR-PASSWORD]. Replace it with your Supabase database password.");
  }

  if (env.jwtSecret && env.jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be at least 32 characters (AdminJS uses it as a session cookie secret).");
  }

  if (problems.length > 0) {
    console.error("\nRefusing to start — invalid environment configuration:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error("");
    process.exit(1);
  }
}
