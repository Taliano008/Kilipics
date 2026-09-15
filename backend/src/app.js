import { mkdirSync } from "node:fs";
import { env, assertEnv } from "./env.js";
import { ping, closePool } from "./db/connection.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { ApiError } from "./lib/http-errors.js";
import consumerAuthRoutes from "./routes/auth/consumer.js";
import merchantAuthRoutes from "./routes/auth/merchant.js";
import merchantBusinessRoutes from "./routes/merchant/business.js";
import merchantMediaRoutes from "./routes/merchant/media.js";
import merchantServicesRoutes from "./routes/merchant/services.js";
import publicCatalogRoutes from "./routes/public/catalog.js";
import analyticsRoutes from "./routes/public/analytics.js";

assertEnv();

// Photo uploads (merchant business photos) land here — see media.js under
// routes/merchant. Created eagerly so @fastify/static has a root that
// exists even before the first upload.
mkdirSync(env.uploadsDir, { recursive: true });

const app = Fastify({
  logger: true,
  ajv: {
    customOptions: {
      allErrors: true,
      coerceTypes: false,
      removeAdditional: false,
    },
  },
  // Raised from the original 5MB so a single multipart photo upload (raw
  // phone-camera JPEGs commonly run 4-8MB) fits under Fastify's own request
  // body cap, on top of @fastify/multipart's own fileSize limit below.
  bodyLimit: 12 * 1024 * 1024,
});

await app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-App-Token"],
});

// Global baseline: generous enough not to bother normal use, but closes off
// unrestricted brute-forcing of any endpoint. Auth routes layer a much
// tighter per-route limit on top of this (see their `config.rateLimit`).
await app.register(rateLimit, {
  max: 300,
  timeWindow: "1 minute",
});

// One file per request, capped well under bodyLimit above so the multipart
// parser itself rejects an oversized upload with a clean error instead of
// the connection just dying mid-stream.
await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// Serves merchant-uploaded photos back out at env.uploadsBaseUrl (see
// media.js for the upload side). decorateReply: false — nothing here uses
// reply.sendFile() outside this plugin's own route.
await app.register(fastifyStatic, {
  root: env.uploadsDir,
  prefix: "/uploads/",
  decorateReply: false,
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
await app.register(merchantBusinessRoutes, { prefix: "/api/merchant/business" });
await app.register(merchantMediaRoutes, { prefix: "/api/merchant/media" });
await app.register(merchantServicesRoutes, { prefix: "/api/merchant/services" });
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
