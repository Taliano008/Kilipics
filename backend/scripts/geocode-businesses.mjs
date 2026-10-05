// One-off backfill: looks up approximate map coordinates for every business
// that has an address but no location yet (location_precision = 'none').
// New saves do this automatically (saveStep2); this catches businesses
// created before that. Safe to re-run — it only touches 'none' rows and
// never overwrites a merchant-placed pin.
//
//   node scripts/geocode-businesses.mjs            look up and save
//   node scripts/geocode-businesses.mjs --dry-run  only print what it would do
import "dotenv/config";
import { pool, query } from "../src/db/connection.js";
import { geocodeAddress } from "../src/services/geocode.js";
import { locateFromAddress } from "../src/services/merchant-business.js";

const dryRun = process.argv.includes("--dry-run");

const rows = await query(
  `SELECT id, name, full_address FROM businesses
    WHERE location_precision = 'none' AND full_address <> ''
    ORDER BY created_at`,
);
console.log(`${rows.length} business(es) without a location${dryRun ? " (dry run)" : ""}\n`);

let found = 0;
for (const row of rows) {
  const ok = dryRun
    ? Boolean(await geocodeAddress(row.full_address))
    : await locateFromAddress(row.id, row.full_address);
  if (ok) found++;
  console.log(`${ok ? "located " : "no match"}  ${row.name} — ${row.full_address}`);
  await new Promise((resolve) => setTimeout(resolve, 1100)); // Nominatim: 1 request/second
}

console.log(`\n${found}/${rows.length} located.`);
await pool.end();
