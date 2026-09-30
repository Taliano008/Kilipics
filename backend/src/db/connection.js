import pg from "pg";
import { env } from "../env.js";

// Postgres (Supabase) behind the same query()/queryOne()/execute() API the
// rest of the backend was written against on MySQL. The type handling below
// is load-bearing for API correctness, not just convenience — it keeps
// every row shape identical to what the mysql2 pool used to return:
// - DATE stays a plain "YYYY-MM-DD" string. pg's default builds a JS Date in
//   *local* time, which would shift availability.date near midnight and
//   serialize as a full ISO datetime.
// - TIMESTAMP (always UTC wall-clock, see the migrations) comes back as
//   "YYYY-MM-DD HH:MM:SS.mmm" — the format lib/dates.js parseDbDateTime()
//   and every createdAt/updatedAt in the API responses expect.
// - NUMERIC (rating, would_return) comes back as a number, not a string,
//   or the mobile app's z.number() schema fails.
// - BIGINT (COUNT(*), SUM(...)) comes back as a number too.
// - Outgoing JS Dates are serialized as UTC, never with the server's local
//   offset, since the timestamp columns carry no time zone of their own.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, normalizeTimestamp);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => (value == null ? null : Number(value)));
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => (value == null ? null : Number(value)));
pg.defaults.parseInputDatesAsUTC = true;

// Postgres drops trailing fractional zeros ("10:00:00.1", "10:00:00");
// MySQL's DATETIME(3) always printed exactly three digits.
function normalizeTimestamp(value) {
  if (value == null) return null;
  const [datePart, timePart = "00:00:00"] = value.split(" ");
  const [whole, fraction = ""] = timePart.split(".");
  return `${datePart} ${whole}.${fraction.padEnd(3, "0").slice(0, 3)}`;
}

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  // Supabase requires TLS. Its certificate chains to Supabase's own CA,
  // which isn't in Node's default trust store.
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

// Every query in this codebase uses MySQL-style "?" placeholders; Postgres
// wants $1, $2, ... Rewrites them, skipping anything inside '...' string
// literals or "..." quoted identifiers.
export function toPgPlaceholders(sql) {
  let out = "";
  let index = 0;
  let quote = null;
  for (const ch of sql) {
    if (quote) {
      if (ch === quote) quote = null;
      out += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
    } else if (ch === "?") {
      out += `$${++index}`;
    } else {
      out += ch;
    }
  }
  return out;
}

// The 0/1 flag columns (active, booking_enabled, limited_listing, ...) are
// SMALLINT, same as MySQL's TINYINT(1). mysql2 silently turned JS booleans
// into 1/0; pg would send 'true'/'false', which SMALLINT rejects.
function normalizeParams(params = []) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    return value;
  });
}

function makeRunner(client) {
  async function run(sql, params) {
    return client.query(toPgPlaceholders(sql), normalizeParams(params));
  }
  return {
    async query(sql, params) {
      return (await run(sql, params)).rows;
    },
    async execute(sql, params) {
      const result = await run(sql, params);
      return { affectedRows: result.rowCount ?? 0, rows: result.rows };
    },
  };
}

const poolRunner = makeRunner(pool);

export async function query(sql, params) {
  return poolRunner.query(sql, params);
}

export async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql, params) {
  return poolRunner.execute(sql, params);
}

// fn receives a { query, execute } bound to one client for the whole
// transaction.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(makeRunner(client));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function ping() {
  await pool.query("SELECT 1");
}

export async function closePool() {
  await pool.end();
}
