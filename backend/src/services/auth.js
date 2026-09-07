import bcrypt from "bcrypt";

const BCRYPT_COST = 12;

// Password hashing only — generic across both auth systems. Token issuance
// and verification are per-identity (see merchant-auth.js, consumer-auth.js)
// because a merchant token and a consumer token must never verify against
// the other system's table.
export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
