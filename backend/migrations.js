import "dotenv/config";
import mysql from "mysql2/promise";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "src", "db", "migrations");

const dbName = process.env.DB_NAME || "kilipicks";
const statusOnly = process.argv.includes("--status");
const dryRun = process.argv.includes("--dry-run");

function checksum(contents) {
  return createHash("sha256").update(contents.replace(/\r\n/g, "\n")).digest("hex");
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
    charset: "utf8mb4",
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`,
    );
    await connection.query(`USE \`${dbName}\`;`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) NOT NULL PRIMARY KEY,
        checksum   CHAR(64)     NOT NULL,
        applied_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      );
    `);

    const files = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();

    const [appliedRows] = await connection.query("SELECT filename, checksum FROM schema_migrations");
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

      console.log(`apply  ${file}`);
      try {
        await connection.query(contents);
      } catch (err) {
        console.error(`\nMigration "${file}" failed: ${err.message}`);
        process.exitCode = 1;
        return;
      }

      await connection.execute(
        "INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)",
        [file, sum],
      );
    }

    if (!dryRun) console.log("\nMigrations up to date.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
