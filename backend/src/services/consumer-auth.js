import { createTokenService } from "./tokens.js";

const consumerTokens = createTokenService({
  prefix: "kp_u_",
  tokensTable: "user_tokens",
  ownerColumn: "user_id",
  ownerTable: "users",
});

export const issueConsumerToken = consumerTokens.issueToken;
export const revokeConsumerToken = consumerTokens.revokeToken;

export async function verifyConsumerToken(rawToken) {
  const verified = await consumerTokens.verifyToken(rawToken);
  if (!verified) return null;
  return { userId: verified.ownerId, tokenId: verified.tokenId };
}

export function serializeConsumer(user) {
  return { id: user.id, fullName: user.full_name, email: user.email, photoUrl: user.photo_url };
}
