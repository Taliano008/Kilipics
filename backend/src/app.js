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
import consumerMediaRoutes from "./routes/consumer/media.js";
import consumerReviewRoutes from "./routes/consumer/reviews.js";
import consumerBookingRoutes from "./routes/consumer/bookings.js";
import consumerNotificationRoutes from "./routes/consumer/notifications.js";
import merchantAuthRoutes from "./routes/auth/merchant.js";
import merchantBusinessRoutes from "./routes/merchant/business.js";
import merchantMediaRoutes from "./routes/merchant/media.js";
import merchantServicesRoutes from "./routes/merchant/services.js";
import merchantBookingsRoutes from "./routes/merchant/bookings.js";
import merchantSalesRoutes from "./routes/merchant/sales.js";
import publicCatalogRoutes from "./routes/public/catalog.js";
import publicAvailabilityRequestRoutes from "./routes/public/availability-requests.js";
import publicReviewRoutes from "./routes/public/reviews.js";
import analyticsRoutes from "./routes/public/analytics.js";

assertEnv();

// Photo uploads (merchant business photos) land here — see media.js under
// routes/merchant. Created eagerly so @fastify/static has a root that
// exists even before the first upload.
mkdirSync(env.uploadsDir, { recursive: true });

const app = Fastify({
  logger: true,
  // Makes request.ip the real client address when deployed behind a proxy
  // (see TRUST_PROXY_HOPS in env.js) — it's what rate limiting keys on.
  trustProxy: env.trustProxyHops > 0 ? env.trustProxyHops : false,
  ajv: {
    customOptions: {
      allErrors: true,
      coerceTypes: false,
      removeAdditional: false,
    },
  },
  // Kept a bit above @fastify/multipart's own 5MB fileSize limit below, to
  // leave room for multipart boundary/field overhead around the file part
  // itself rather than the body cap tripping first with a less useful error.
  bodyLimit: 6 * 1024 * 1024,
});

// The mobile app is a native client: it sends no Origin header and isn't
// subject to CORS at all, so this only decides which *websites* may call
// the API from a browser. In production that's nobody unless listed in
// CORS_ORIGINS; in development any origin is allowed so Expo web
// (localhost:8081) keeps working.
await app.register(cors, {
  origin: env.corsOrigins.length > 0 ? env.corsOrigins : env.nodeEnv !== "production",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
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

  // Fastify's own built-in errors (bad JSON body, unsupported content-type,
  // payload too large, ...) carry a real statusCode/code and are almost
  // always the client's fault (4xx) — respecting that instead of always
  // falling through to 500 keeps the response honest and avoids masking a
  // mundane client bug as a fake "internal_error".
  if (err.statusCode && err.statusCode < 500) {
    reply.code(err.statusCode);
    return { error: err.code || "bad_request", message: err.message };
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
await app.register(consumerMediaRoutes, { prefix: "/api/consumer/media" });
await app.register(consumerReviewRoutes, { prefix: "/api/consumer" });
await app.register(consumerBookingRoutes, { prefix: "/api/consumer/bookings" });
await app.register(consumerNotificationRoutes, { prefix: "/api/consumer/notifications" });
await app.register(merchantAuthRoutes, { prefix: "/api/auth/merchant" });
await app.register(merchantBusinessRoutes, { prefix: "/api/merchant/business" });
await app.register(merchantMediaRoutes, { prefix: "/api/merchant/media" });
await app.register(merchantServicesRoutes, { prefix: "/api/merchant/services" });
await app.register(merchantBookingsRoutes, { prefix: "/api/merchant/bookings" });
await app.register(merchantSalesRoutes, { prefix: "/api/merchant/sales" });
await app.register(publicCatalogRoutes, { prefix: "/api/public" });
await app.register(publicAvailabilityRequestRoutes, { prefix: "/api/public" });
await app.register(publicReviewRoutes, { prefix: "/api/public" });
await app.register(analyticsRoutes, { prefix: "/api/analytics" });

// Someone opening the server's bare address in a browser gets a pointer
// rather than a 404 that looks like a failure. Only the app uses this API.
app.get("/", async () => ({ service: "KiliPicks API", ok: true, health: "/healthz" }));

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
