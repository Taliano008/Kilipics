import { randomBytes } from "node:crypto";
import { queryOne } from "../db/connection.js";
import { unauthorized } from "../lib/http-errors.js";
import {
  findMerchantForUser,
  findBusinessIdForMerchant,
  verifyMerchantToken,
  createMerchant,
} from "../services/merchant-auth.js";
import { verifyConsumerToken } from "../services/consumer-auth.js";

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

// Shared by every merchant-facing route that a not-yet-fully-onboarded
// merchant needs to hit before they have a dedicated merchant token — the
// onboarding wizard (routes/merchant/business.js) and photo uploads
// (routes/merchant/media.js) both accept either token type. Kept in one
// place because the consumer-token auto-provisioning branch below is
// security-sensitive (see the password comment) and must not drift between
// call sites.
export async function flexibleMerchantAuth(request) {
  const match = BEARER_PATTERN.exec(request.headers.authorization ?? "");
  const rawToken = match ? match[1] : null;
  if (!rawToken) throw unauthorized("Authorization token required.", "missing_token");

  if (rawToken.startsWith("kp_m_")) {
    const verified = await verifyMerchantToken(rawToken);
    if (!verified) throw unauthorized("Invalid or expired merchant token.", "invalid_token");
    request.merchant = verified;
    return;
  }

  if (rawToken.startsWith("kp_u_")) {
    const verifiedUser = await verifyConsumerToken(rawToken);
    if (!verifiedUser) throw unauthorized("Invalid or expired user token.", "invalid_token");

    let merchant = await findMerchantForUser(verifiedUser.userId);
    let merchantToken = null;
    if (!merchant) {
      const user = await queryOne("SELECT * FROM users WHERE id = ?", [verifiedUser.userId]);
      const created = await createMerchant({
        fullName: user?.full_name || "Merchant Partner",
        email: user?.email,
        // Random per-account password, never returned to the client and
        // never reused across accounts. This quick-start path only ever
        // authenticates this merchant identity via the issued bearer token
        // (below) — password-based /api/auth/merchant/login stays locked
        // out until the owner explicitly sets a real password (the
        // "Switch to seller" flow, POST /api/auth/consumer/merchant).
        // A shared/hardcoded password here would let anyone who learns this
        // merchant's email log straight into their business account.
        password: randomBytes(32).toString("hex"),
        ownerUserId: verifiedUser.userId,
      });
      merchant = await queryOne("SELECT * FROM merchants WHERE id = ?", [created.merchant.id]);
      merchantToken = created.token;
    }
    // Else: a merchant identity already exists for this consumer. Don't mint
    // a fresh token on every such request — issueToken() evicts the oldest
    // of the 3 active tokens once the cap is hit, so doing this
    // unconditionally would silently sign out another active session (e.g.
    // a different device) purely from this consumer-token fallback path
    // being used repeatedly. The client only ever adopts the merchant token
    // once (when it's non-null) and prefers it over the consumer token from
    // then on, so this branch should only actually run again if that token
    // was lost client-side — a genuine one-time recovery, not steady state.
    const businessId = await findBusinessIdForMerchant(merchant.id);
    request.merchant = {
      merchantId: merchant.id,
      businessId,
      tokenId: null,
      newMerchantToken: merchantToken,
    };
    return;
  }

  throw unauthorized("Unrecognized token type.", "invalid_token");
}
