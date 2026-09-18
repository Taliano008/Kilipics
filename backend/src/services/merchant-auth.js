import { execute, queryOne } from "../db/connection.js";
import { conflict } from "../lib/http-errors.js";
import { newId } from "../lib/ids.js";
import { hashPassword } from "./auth.js";
import { createTokenService } from "./tokens.js";

const merchantTokens = createTokenService({
  prefix: "kp_m_",
  tokensTable: "merchant_tokens",
  ownerColumn: "merchant_id",
  ownerTable: "merchants",
  ownerStatusColumn: "status",
  statusCheck: (status) => status !== "suspended",
});

export const issueMerchantToken = merchantTokens.issueToken;
export const revokeMerchantToken = merchantTokens.revokeToken;

// Wraps the generic token verification with the one merchant-specific bit
// every route needs alongside it: which business (if any) this merchant owns.
export async function verifyMerchantToken(rawToken) {
  const verified = await merchantTokens.verifyToken(rawToken);
  if (!verified) return null;
  const businessId = await findBusinessIdForMerchant(verified.ownerId);
  return { merchantId: verified.ownerId, businessId, tokenId: verified.tokenId };
}

export async function findBusinessIdForMerchant(merchantId) {
  const row = await queryOne("SELECT id FROM businesses WHERE merchant_id = ?", [merchantId]);
  return row ? row.id : null;
}

// A consumer identity owns at most one merchant identity in Phase Zero —
// this is how createMerchant checks that, and how the consumer routes look
// up "does this signed-in person already have a business account."
export async function findMerchantForUser(userId) {
  return queryOne("SELECT * FROM merchants WHERE owner_user_id = ?", [userId]);
}

// Async because, when a business exists, this looks up its onboarding
// progress — the mobile client's "Switch to seller" entry point
// (app/(tabs)/account.tsx) needs onboardingStep/onboardingSubmitted
// alongside hasBusiness to route a merchant back into onboarding at the
// step they left off at, rather than dumping them into a half-empty
// dashboard the moment a businesses row exists at all.
export async function serializeMerchant(merchant, businessId) {
  const onboarding = businessId
    ? await queryOne("SELECT onboarding_step, submitted_at FROM businesses WHERE id = ?", [businessId])
    : null;

  return {
    id: merchant.id,
    fullName: merchant.full_name,
    email: merchant.email,
    status: merchant.status,
    hasBusiness: Boolean(businessId),
    ...(businessId
      ? {
          businessId,
          onboardingStep: onboarding?.onboarding_step ?? 1,
          onboardingSubmitted: Boolean(onboarding?.submitted_at),
        }
      : {}),
  };
}

// Shared by both entry points into merchant creation: the standalone
// POST /api/auth/merchant/signup (ownerUserId null — a business owner with
// no consumer account at all) and the consumer-side "become a seller" flow
// (ownerUserId set to the signed-in consumer's id). Either way this creates
// a genuinely separate row with its own password, never a role flag on an
// existing account.
export async function createMerchant({ fullName, email, password, ownerUserId = null }) {
  // Checked before the email-uniqueness check on purpose: when ownerUserId
  // is set, a duplicate-email conflict almost always means this exact
  // consumer's own prior merchant signup (their email, tried again) — that
  // deserves "you already have a business profile," not the generic
  // email-taken message a stranger's collision would get.
  if (ownerUserId) {
    const alreadyLinked = await findMerchantForUser(ownerUserId);
    if (alreadyLinked) {
      throw conflict("merchant_already_linked", "This account already has a linked business profile.");
    }
  }

  const existingEmail = await queryOne("SELECT id FROM merchants WHERE email = ?", [email]);
  if (existingEmail) throw conflict("email_taken", "An account with this email already exists.");

  const id = newId();
  const passwordHash = await hashPassword(password);
  await execute(
    "INSERT INTO merchants (id, owner_user_id, full_name, email, password_hash) VALUES (?, ?, ?, ?, ?)",
    [id, ownerUserId, fullName, email, passwordHash],
  );

  const token = await issueMerchantToken(id);
  const merchant = await queryOne("SELECT * FROM merchants WHERE id = ?", [id]);
  return { token, merchant: await serializeMerchant(merchant, null) };
}
