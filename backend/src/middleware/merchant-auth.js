import { unauthorized } from "../lib/http-errors.js";
import { verifyMerchantToken } from "../services/merchant-auth.js";

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

// Fastify preHandler for every merchant-only route. Verifies the bearer
// token and attaches { merchantId, businessId, tokenId } to request.merchant
// — routes behind this can trust it's present without re-checking.
export async function merchantAuth(request) {
  const match = BEARER_PATTERN.exec(request.headers.authorization ?? "");
  const rawToken = match ? match[1] : null;

  const verified = await verifyMerchantToken(rawToken);
  if (!verified) throw unauthorized("Invalid or expired token.", "invalid_token");

  request.merchant = verified;
}
