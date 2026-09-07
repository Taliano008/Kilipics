import mysql from "mysql2/promise";
import { env } from "../env.js";

// These pool options are load-bearing for API correctness, not just
// performance:
// - dateStrings: without it, DATE/TIME columns come back as JS Date objects
//   built in *local* time, which would shift availability.date near
//   midnight and serialize as a full ISO datetime instead of "YYYY-MM-DD".
// - decimalNumbers: without it, DECIMAL columns (rating, would_return) come
//   back as strings, failing the mobile app's z.number() schema.
// - multipleStatements is deliberately false here — the migration runner
//   opens its own separate connection with it enabled instead.
export const pool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "Z",
  dateStrings: true,
  decimalNumbers: true,
  multipleStatements: false,
});

export async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql, params) {
  const [result] = await pool.execute(sql, params);
  return result;
}

export async function withTransaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function ping() {
  await pool.query("SELECT 1");
}

export async function closePool() {
  await pool.end();
}
