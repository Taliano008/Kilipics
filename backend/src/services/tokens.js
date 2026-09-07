import crypto from "node:crypto";
import { execute, query, queryOne } from "../db/connection.js";
import { parseDbDateTime } from "../lib/dates.js";
import { newId } from "../lib/ids.js";

const TOKEN_TTL_DAYS = 90;
const SLIDE_THRESHOLD_DAYS = 14;
const SLIDE_EXTENSION_DAYS = 7;
const MAX_ACTIVE_TOKENS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// merchant_tokens/merchant_id and user_tokens/user_id are structurally
// identical (90-day sliding expiry, 3-token cap, SHA-256-hashed lookup) —
// this factory is the one place that shape is expressed, so the two
// separate auth systems (consumer, merchant) can't drift apart on it.
// Table/column names come only from call sites in this file, never from
// request data, so the interpolation below carries no injection risk.
export function createTokenService({ prefix, tokensTable, ownerColumn, ownerTable, ownerStatusColumn, statusCheck }) {
  function generateRawToken() {
    return prefix + crypto.randomBytes(32).toString("base64url");
  }

  async function issueToken(ownerId) {
    const activeTokens = await query(
      `SELECT id FROM ${tokensTable} WHERE ${ownerColumn} = ? ORDER BY created_at ASC`,
      [ownerId],
    );
    if (activeTokens.length >= MAX_ACTIVE_TOKENS) {
      const toDrop = activeTokens.slice(0, activeTokens.length - MAX_ACTIVE_TOKENS + 1);
      for (const token of toDrop) {
        await execute(`DELETE FROM ${tokensTable} WHERE id = ?`, [token.id]);
      }
    }

    const rawToken = generateRawToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * MS_PER_DAY);
    await execute(
      `INSERT INTO ${tokensTable} (id, ${ownerColumn}, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
      [newId(), ownerId, hashToken(rawToken), expiresAt],
    );
    return rawToken;
  }

  // Returns { ownerId, tokenId } on success, null on any failure — callers
  // never learn *why* a token was rejected (expired, unknown, suspended
  // owner), only that it was.
  async function verifyToken(rawToken) {
    if (!rawToken) return null;

    const statusSelect = ownerStatusColumn ? `, o.${ownerStatusColumn} AS owner_status` : "";
    const row = await queryOne(
      `SELECT t.id AS token_id, t.expires_at, o.id AS owner_id${statusSelect}
       FROM ${tokensTable} t
       JOIN ${ownerTable} o ON o.id = t.${ownerColumn}
       WHERE t.token_hash = ?`,
      [hashToken(rawToken)],
    );
    if (!row) return null;
    if (statusCheck && !statusCheck(row.owner_status)) return null;

    const now = new Date();
    const expiresAt = parseDbDateTime(row.expires_at);
    if (expiresAt <= now) return null;

    const msUntilExpiry = expiresAt.getTime() - now.getTime();
    const nextExpiresAt =
      msUntilExpiry < SLIDE_THRESHOLD_DAYS * MS_PER_DAY
        ? new Date(expiresAt.getTime() + SLIDE_EXTENSION_DAYS * MS_PER_DAY)
        : expiresAt;

    await execute(`UPDATE ${tokensTable} SET last_used_at = ?, expires_at = ? WHERE id = ?`, [
      now,
      nextExpiresAt,
      row.token_id,
    ]);

    return { ownerId: row.owner_id, tokenId: row.token_id };
  }

  async function revokeToken(tokenId) {
    await execute(`DELETE FROM ${tokensTable} WHERE id = ?`, [tokenId]);
  }

  return { issueToken, verifyToken, revokeToken };
}
