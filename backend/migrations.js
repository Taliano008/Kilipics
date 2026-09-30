import "dotenv/config";
import pg from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "src", "db", "migrations");

const statusOnly = process.argv.includes("--status");
const dryRun = process.argv.includes("--dry-run");

function checksum(contents) {
  return createHash("sha256").update(contents.replace(/\r\n/g, "\n")).digest("hex");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes("[YOUR-PASSWORD]")) {
    console.error("DATABASE_URL is not set in backend/.env (see .env.example for the Supabase connection string).");
    process.exitCode = 1;
    return;
  }

  // Same TLS rule as src/db/connection.js.
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  try {
    // RLS for the same reason as 022_enable_row_level_security.sql — this
    // table is in the public schema too.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) NOT NULL PRIMARY KEY,
        checksum   CHAR(64)     NOT NULL,
        applied_at TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
      );
      ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
    `);

    const files = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();

    const { rows: appliedRows } = await client.query("SELECT filename, checksum FROM schema_migrations");
    const applied = new Map(appliedRows.map((row) => [row.filename, row.checksum]));

    if (statusOnly) {
      console.log(`${applied.size} applied, ${files.length - applied.size} pending:\n`);
      for (const file of files) {
        console.log(`  ${applied.has(file) ? "[applied]" : "[pending]"} ${file}`);
      }
      return;
    }

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const contents = readFileSync(fullPath, "utf8");
      const sum = checksum(contents);
      const existing = applied.get(file);

      if (existing === sum) {
        console.log(`skip   ${file}`);
        continue;
      }

      if (existing && existing !== sum) {
        console.error(`\nMigration "${file}" was already applied but its contents have changed.`);
        console.error("Never edit an applied migration — add a new numbered migration instead.");
        process.exitCode = 1;
        return;
      }

      if (dryRun) {
        console.log(`would apply   ${file}`);
        continue;
      }

      // Postgres DDL is transactional: a migration that fails partway
      // leaves nothing behind, and is simply retried on the next run.
      console.log(`apply  ${file}`);
      try {
        await client.query("BEGIN");
        await client.query(contents);
        await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [file, sum]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`\nMigration "${file}" failed: ${err.message}`);
        process.exitCode = 1;
        return;
      }
    }

    if (!dryRun) console.log("\nMigrations up to date.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
