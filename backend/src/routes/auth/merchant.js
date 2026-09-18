import { queryOne } from "../../db/connection.js";
import { ApiError } from "../../lib/http-errors.js";
import { emailSchema, passwordSchema } from "../../lib/validation.js";
import { verifyPassword } from "../../services/auth.js";
import { merchantAuth } from "../../middleware/merchant-auth.js";
import {
  createMerchant,
  findBusinessIdForMerchant,
  issueMerchantToken,
  revokeMerchantToken,
  serializeMerchant,
} from "../../services/merchant-auth.js";

export default async function merchantAuthRoutes(app) {
  // Standalone merchant signup — a business owner with no consumer account
  // at all. The consumer-side "become a seller" flow (see routes/auth/
  // consumer.js) reaches the same createMerchant() with ownerUserId set;
  // this route always leaves it null.
  app.post(
    "/signup",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          required: ["fullName", "email", "password"],
          additionalProperties: false,
          properties: {
            fullName: { type: "string", minLength: 1, maxLength: 255 },
            email: emailSchema,
            password: passwordSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const result = await createMerchant(request.body);
      reply.code(201);
      return result;
    },
  );

  app.post(
    "/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          additionalProperties: false,
          properties: {
            // Deliberately unconstrained beyond presence — this checks
            // credentials against an existing row, it doesn't mint one.
            email: { type: "string", minLength: 1, maxLength: 255 },
            password: { type: "string", minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    async (request) => {
      const { email, password } = request.body;

      // Same 401 + generic message whether the email is unknown or the
      // password is wrong — never reveal which one it was.
      const merchant = await queryOne("SELECT * FROM merchants WHERE email = ?", [email]);
      if (!merchant) throw new ApiError(401, "invalid_credentials", "Invalid email or password.");

      const passwordMatches = await verifyPassword(password, merchant.password_hash);
      if (!passwordMatches) throw new ApiError(401, "invalid_credentials", "Invalid email or password.");

      if (merchant.status === "suspended") {
        throw new ApiError(403, "account_suspended", "This account has been suspended.");
      }

      const token = await issueMerchantToken(merchant.id);
      const businessId = await findBusinessIdForMerchant(merchant.id);

      return { token, merchant: await serializeMerchant(merchant, businessId) };
    },
  );

  app.post("/signout", { preHandler: merchantAuth }, async (request) => {
    await revokeMerchantToken(request.merchant.tokenId);
    return { ok: true };
  });

  app.get("/me", { preHandler: merchantAuth }, async (request) => {
    const merchant = await queryOne("SELECT * FROM merchants WHERE id = ?", [request.merchant.merchantId]);
    return { merchant: await serializeMerchant(merchant, request.merchant.businessId) };
  });
}
