import { execute, query, queryOne } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest } from "../lib/http-errors.js";

const TYPES = new Set(["income", "expense"]);
const GOAL_KEYS = ["daily", "weekly", "monthly"];
const DEFAULT_GOALS = { daily: 5000, weekly: 30000, monthly: 100000 };
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 1_000_000_000;
const MAX_IMPORT = 500;
// The Sales tab works in the current month; keep a little history behind it.
const LISTED_DAYS = 400;

function requireBusinessId(businessId) {
  if (!businessId) {
    throw badRequest(
      "business_required",
      "Finish setting up your business profile before recording sales.",
    );
  }
}

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function serializeTransaction(row) {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    method: row.method,
    date: row.occurred_on,
    createdAt: row.created_at,
  };
}

function serializeGoals(row) {
  return row
    ? { daily: row.daily, weekly: row.weekly, monthly: row.monthly }
    : { ...DEFAULT_GOALS };
}

// Validates one transaction from the client into column values. `fields`
// prefixes error field names so an import can say which row was wrong.
function parseTransaction(input) {
  if (!TYPES.has(input?.type)) {
    throw badRequest("invalid_type", "Type must be income or expense.", ["type"]);
  }
  const amount = Math.round(Number(input?.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    throw badRequest("invalid_amount", "Enter an amount greater than zero.", ["amount"]);
  }
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  if (!description) {
    throw badRequest("description_required", "A description is required.", ["description"]);
  }
  if (!isValidDate(input?.date)) {
    throw badRequest("invalid_date", "Date must be a YYYY-MM-DD date.", ["date"]);
  }
  const method = typeof input?.method === "string" && input.method.trim() ? input.method.trim() : "Cash";
  return {
    type: input.type,
    amount,
    description: description.slice(0, 255),
    method: method.slice(0, 40),
    date: input.date,
  };
}

export async function getMerchantSales(businessId) {
  requireBusinessId(businessId);
  const rows = await query(
    `SELECT * FROM sales_transactions
     WHERE business_id = ? AND occurred_on >= (CURRENT_DATE - ${LISTED_DAYS})
     ORDER BY occurred_on DESC, created_at DESC`,
    [businessId],
  );
  const goals = await queryOne("SELECT * FROM sales_goals WHERE business_id = ?", [businessId]);
  return { transactions: rows.map(serializeTransaction), goals: serializeGoals(goals) };
}

// Merchants can back-date an entry (yesterday's takings recorded this
// morning) but not into the future. The server only knows UTC, so "future"
// allows one day of slack for time zones ahead of it, like Nairobi's.
const MAX_BACKDATE_DAYS = 90;

function assertRecordableDate(date) {
  const shift = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  if (date > shift(1)) {
    throw badRequest("future_date", "Transactions can't be dated in the future.", ["date"]);
  }
  if (date < shift(-MAX_BACKDATE_DAYS)) {
    throw badRequest(
      "date_too_old",
      `Transactions can be back-dated up to ${MAX_BACKDATE_DAYS} days.`,
      ["date"],
    );
  }
}

export async function createSalesTransaction(businessId, input) {
  requireBusinessId(businessId);
  const tx = parseTransaction(input);
  assertRecordableDate(tx.date);
  const id = newId();
  await execute(
    `INSERT INTO sales_transactions (id, business_id, type, amount, description, method, occurred_on)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, businessId, tx.type, tx.amount, tx.description, tx.method, tx.date],
  );
  return serializeTransaction(await queryOne("SELECT * FROM sales_transactions WHERE id = ?", [id]));
}

export async function deleteSalesTransaction(businessId, transactionId) {
  requireBusinessId(businessId);
  const result = await execute("DELETE FROM sales_transactions WHERE id = ? AND business_id = ?", [
    transactionId,
    businessId,
  ]);
  // Already gone (e.g. deleted on another phone) is still a success: the
  // merchant wanted it removed, and it is.
  return { deleted: result.affectedRows > 0 };
}

export async function saveSalesGoals(businessId, input) {
  requireBusinessId(businessId);
  const current = serializeGoals(
    await queryOne("SELECT * FROM sales_goals WHERE business_id = ?", [businessId]),
  );
  const next = { ...current };
  for (const key of GOAL_KEYS) {
    if (input?.[key] === undefined) continue;
    const value = Math.round(Number(input[key]));
    if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) {
      throw badRequest("invalid_goal", "Targets must be zero or more.", [key]);
    }
    next[key] = value;
  }
  await execute(
    `INSERT INTO sales_goals (business_id, daily, weekly, monthly) VALUES (?, ?, ?, ?)
     ON CONFLICT (business_id) DO UPDATE
       SET daily = EXCLUDED.daily, weekly = EXCLUDED.weekly, monthly = EXCLUDED.monthly`,
    [businessId, next.daily, next.weekly, next.monthly],
  );
  return next;
}

// One-time upload of what a phone had in its old local-only store. Each row
// carries the id it had on the device (clientRef); a row already uploaded
// is skipped, so the app can safely retry after a dropped connection.
// Malformed rows are skipped rather than failing the whole batch — the goal
// is to rescue as much of the merchant's history as possible.
export async function importLocalSales(businessId, input) {
  requireBusinessId(businessId);
  const rows = Array.isArray(input?.transactions) ? input.transactions.slice(0, MAX_IMPORT) : [];

  let imported = 0;
  for (const raw of rows) {
    const clientRef = typeof raw?.clientRef === "string" ? raw.clientRef.trim().slice(0, 64) : "";
    if (!clientRef) continue;
    let tx;
    try {
      tx = parseTransaction(raw);
    } catch {
      continue;
    }
    const created = new Date(raw?.createdAt);
    const createdAt = Number.isNaN(created.getTime()) ? new Date() : created;
    const result = await execute(
      `INSERT INTO sales_transactions
         (id, business_id, type, amount, description, method, occurred_on, client_ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (business_id, client_ref) DO NOTHING`,
      [newId(), businessId, tx.type, tx.amount, tx.description, tx.method, tx.date, clientRef, createdAt],
    );
    imported += result.affectedRows;
  }

  // Targets the merchant set on the device win only if none are saved yet.
  if (input?.goals && typeof input.goals === "object") {
    const existing = await queryOne("SELECT business_id FROM sales_goals WHERE business_id = ?", [
      businessId,
    ]);
    if (!existing) {
      try {
        await saveSalesGoals(businessId, input.goals);
      } catch {
        // Unusable local targets — keep the defaults.
      }
    }
  }

  return { imported, ...(await getMerchantSales(businessId)) };
}
