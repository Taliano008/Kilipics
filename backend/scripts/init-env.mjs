// Generates a local .env with random dev secrets. These are single-machine,
// pre-launch, local-dev-only secrets — never shared, never committed, never
// used in production. DB_PASSWORD is left blank for the human to fill in.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const examplePath = path.join(root, ".env.example");
const envPath = path.join(root, ".env");

const force = process.argv.includes("--force");

if (existsSync(envPath) && !force) {
  console.error(`.env already exists at ${envPath}. Pass --force to overwrite.`);
  process.exit(1);
}

const jwtSecret = randomBytes(48).toString("base64url");
const adminPassword = randomBytes(18).toString("base64url");
const analyticsAppToken = randomBytes(32).toString("base64url");

let contents = readFileSync(examplePath, "utf8");
contents = contents
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${jwtSecret}`)
  .replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${adminPassword}`)
  .replace(/^ANALYTICS_APP_TOKEN=.*$/m, `ANALYTICS_APP_TOKEN=${analyticsAppToken}`);

writeFileSync(envPath, contents, "utf8");

console.log(`Wrote ${envPath}\n`);
console.log("Generated secrets (local dev only):");
console.log(`  ADMIN_EMAIL:    admin@kilipicks.com (change ADMIN_EMAIL in .env if needed)`);
console.log(`  ADMIN_PASSWORD: ${adminPassword}`);
console.log(`  ANALYTICS_APP_TOKEN: ${analyticsAppToken}`);
console.log(`    -> copy this into the mobile repo's .env as EXPO_PUBLIC_ANALYTICS_APP_TOKEN`);
console.log(`       when you do the mobile-side follow-up (see the backend spec's CORS section).`);
console.log(`\nStill needs filling in by hand: DB_PASSWORD in ${envPath}`);
