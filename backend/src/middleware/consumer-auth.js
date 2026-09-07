import { unauthorized } from "../lib/http-errors.js";
import { verifyConsumerToken } from "../services/consumer-auth.js";

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

// Fastify preHandler for every consumer-only route. Verifies the bearer
// token and attaches { userId, tokenId } to request.consumer — a distinct
// namespace from request.merchant, because these are two separate sessions
// even for a person who holds both identities.
export async function consumerAuth(request) {
  const match = BEARER_PATTERN.exec(request.headers.authorization ?? "");
  const rawToken = match ? match[1] : null;

  const verified = await verifyConsumerToken(rawToken);
  if (!verified) throw unauthorized("Invalid or expired token.", "invalid_token");

  request.consumer = verified;
}
