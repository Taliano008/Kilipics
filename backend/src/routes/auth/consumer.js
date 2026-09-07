import { execute, queryOne } from "../../db/connection.js";
import { ApiError, conflict } from "../../lib/http-errors.js";
import { newId } from "../../lib/ids.js";
import { emailSchema, passwordSchema } from "../../lib/validation.js";
import { hashPassword, verifyPassword } from "../../services/auth.js";
import { consumerAuth } from "../../middleware/consumer-auth.js";
import { issueConsumerToken, revokeConsumerToken, serializeConsumer } from "../../services/consumer-auth.js";
import { createMerchant, findMerchantForUser, issueMerchantToken } from "../../services/merchant-auth.js";

function serializeMerchantSummary(merchant) {
  return {
    id: merchant.id,
    fullName: merchant.full_name,
    email: merchant.email,
    status: merchant.status,
  };
}

export default async function consumerAuthRoutes(app) {
  // Every account starts here as a consumer row. Choosing "business owner"
  // in the mobile app's profile-selection step additionally creates a
  // linked merchant row in the same request — two rows, two password
  // hashes, joined by merchants.owner_user_id, never a role flag on one
  // shared account.
  app.post(
    "/signup",
    {
      schema: {
        body: {
          type: "object",
          required: ["fullName", "email", "password", "accountType"],
          additionalProperties: false,
          properties: {
            fullName: { type: "string", minLength: 1, maxLength: 255 },
            email: emailSchema,
            password: passwordSchema,
            accountType: { type: "string", enum: ["consumer", "merchant"] },
          },
        },
      },
    },
    async (request, reply) => {
      const { fullName, email, password, accountType } = request.body;

      const existing = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
      if (existing) throw conflict("email_taken", "An account with this email already exists.");

      const userId = newId();
      const passwordHash = await hashPassword(password);
      await execute("INSERT INTO users (id, full_name, email, password_hash) VALUES (?, ?, ?, ?)", [
        userId,
        fullName,
        email,
        passwordHash,
      ]);
      const consumerToken = await issueConsumerToken(userId);
      const user = await queryOne("SELECT * FROM users WHERE id = ?", [userId]);

      // A merchant email collision here (someone else already runs a
      // business under this email) surfaces as the normal 409 from
      // createMerchant — the consumer row above is still created and kept;
      // signup isn't rolled back over a merchant-side conflict on an
      // otherwise-valid new consumer account.
      let merchant = null;
      if (accountType === "merchant") {
        const created = await createMerchant({ fullName, email, password, ownerUserId: userId });
        merchant = { token: created.token, profile: created.merchant };
      }

      reply.code(201);
      return {
        consumer: { token: consumerToken, profile: serializeConsumer(user) },
        merchant,
      };
    },
  );

  app.post(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          additionalProperties: false,
          properties: {
            email: { type: "string", minLength: 1, maxLength: 255 },
            password: { type: "string", minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    async (request) => {
      const { email, password } = request.body;

      const user = await queryOne("SELECT * FROM users WHERE email = ?", [email]);
      if (!user) throw new ApiError(401, "invalid_credentials", "Invalid email or password.");

      const passwordMatches = await verifyPassword(password, user.password_hash);
      if (!passwordMatches) throw new ApiError(401, "invalid_credentials", "Invalid email or password.");

      const consumerToken = await issueConsumerToken(user.id);
      const linkedMerchant = await findMerchantForUser(user.id);

      // A linked merchant identity has its own password and is only ever
      // authenticated against its own hash. When the submitted password
      // also matches it (the common case — both were set together at
      // signup), sign the merchant in too as a convenience. If it doesn't
      // match (the merchant password was changed independently since),
      // hand back needsMerchantSignIn instead of silently failing — the
      // mobile client can prompt a separate merchant sign-in rather than
      // pretending the business session doesn't exist.
      let merchant = null;
      if (linkedMerchant) {
        const merchantPasswordMatches = await verifyPassword(password, linkedMerchant.password_hash);
        merchant = merchantPasswordMatches
          ? { token: await issueMerchantToken(linkedMerchant.id), profile: serializeMerchantSummary(linkedMerchant) }
          : { profile: serializeMerchantSummary(linkedMerchant), needsMerchantSignIn: true };
      }

      return {
        consumer: { token: consumerToken, profile: serializeConsumer(user) },
        merchant,
      };
    },
  );

  app.post("/signout", { preHandler: consumerAuth }, async (request) => {
    await revokeConsumerToken(request.consumer.tokenId);
    return { ok: true };
  });

  app.get("/me", { preHandler: consumerAuth }, async (request) => {
    const user = await queryOne("SELECT * FROM users WHERE id = ?", [request.consumer.userId]);
    const linkedMerchant = await findMerchantForUser(user.id);
    return {
      consumer: serializeConsumer(user),
      // Shape matches signup/login's merchant field minus the token — /me
      // never issues a new session, only reports whether one could exist.
      merchant: linkedMerchant ? { profile: serializeMerchantSummary(linkedMerchant) } : null,
    };
  });

  // "Switch to seller" for an existing consumer who has no merchant
  // identity yet. Requires its own password (a genuinely separate
  // credential, not a reuse of the consumer's) because it creates a
  // genuinely separate row.
  app.post(
    "/merchant",
    {
      preHandler: consumerAuth,
      schema: {
        body: {
          type: "object",
          required: ["fullName", "password"],
          additionalProperties: false,
          properties: {
            fullName: { type: "string", minLength: 1, maxLength: 255 },
            password: passwordSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const user = await queryOne("SELECT * FROM users WHERE id = ?", [request.consumer.userId]);
      const created = await createMerchant({
        fullName: request.body.fullName,
        email: user.email,
        password: request.body.password,
        ownerUserId: user.id,
      });
      reply.code(201);
      return { merchant: { token: created.token, profile: created.merchant } };
    },
  );
}
