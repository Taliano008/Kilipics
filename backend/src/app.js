import { env, assertEnv } from "./env.js";
import { ping, closePool } from "./db/connection.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { ApiError } from "./lib/http-errors.js";
import consumerAuthRoutes from "./routes/auth/consumer.js";
import merchantAuthRoutes from "./routes/auth/merchant.js";
import publicCatalogRoutes from "./routes/public/catalog.js";
import analyticsRoutes from "./routes/public/analytics.js";

assertEnv();

const app = Fastify({
  logger: true,
  ajv: {
    customOptions: {
      allErrors: true,
      coerceTypes: false,
      removeAdditional: false,
    },
  },
  bodyLimit: 5 * 1024 * 1024,
});

await app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-App-Token"],
});

// Single error envelope for the whole API: { error, message, fields? }.
// Route handlers throw ApiError (see lib/http-errors.js); ajv schema
// validation failures are normalized into the same shape here too.
app.setErrorHandler((err, request, reply) => {
  if (err instanceof ApiError) {
    reply.code(err.statusCode);
    return { error: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) };
  }

  if (err.validation) {
    reply.code(422);
    return {
      error: "validation_failed",
      message: err.message,
      fields: err.validation.map((v) => v.params?.missingProperty ?? v.instancePath.replace(/^\//, "")),
    };
  }

  request.log.error(err);
  reply.code(500);
  return { error: "internal_error", message: "Something went wrong." };
});

// Two separate auth systems, two separate route trees — see the backend PRD's
// ground rule that consumers and merchants never share a row, a role field,
// or an auth system. /api/auth/consumer/merchant is the one bridge between
// them (a consumer creating a linked merchant identity), and it lives in the
// consumer route tree since it requires a consumer session.
await app.register(consumerAuthRoutes, { prefix: "/api/auth/consumer" });
await app.register(merchantAuthRoutes, { prefix: "/api/auth/merchant" });
await app.register(publicCatalogRoutes, { prefix: "/api/public" });
await app.register(analyticsRoutes, { prefix: "/api/analytics" });

app.get("/healthz", async (request, reply) => {
  try {
    await ping();
    return { ok: true, db: "up" };
  } catch (err) {
    request.log.warn({ err }, "healthz: database ping failed");
    reply.code(503);
    return { ok: false, db: "down" };
  }
});

app.addHook("onClose", async () => {
  await closePool();
});

try {
  await app.listen({ port: env.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
