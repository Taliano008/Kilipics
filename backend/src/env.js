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

  dbHost: process.env.DB_HOST || "localhost",
  dbPort: Number(process.env.DB_PORT) || 3306,
  dbName: process.env.DB_NAME || "kilipicks",
  dbUser: process.env.DB_USER || "root",
  dbPassword: process.env.DB_PASSWORD || "",

  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "90d",

  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",

  analyticsAppToken: process.env.ANALYTICS_APP_TOKEN || "",

  uploadsDir: path.resolve(process.cwd(), process.env.UPLOADS_DIR || "./uploads"),
  uploadsBaseUrl: (process.env.UPLOADS_BASE_URL || "http://localhost:3000/uploads").replace(/\/$/, ""),
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
    DB_NAME: env.dbName,
    DB_USER: env.dbUser,
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
