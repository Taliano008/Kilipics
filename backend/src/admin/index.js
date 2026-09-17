// AdminJS panel — see kilipicks_backend.md §8 for the original spec.
//
// Runs as its own process (server.js), not mounted into the main API. Two
// independent reasons force that split, both discovered the hard way while
// wiring this up:
//
// 1. @adminjs/fastify's authenticated router pulls in @fastify/cookie,
//    @fastify/session and @fastify/formbody — all Fastify-5-only — while
//    the main app (src/app.js) is still on Fastify 4. Registering them on
//    the same instance throws at boot.
// 2. Even pinned to the Fastify-4-compatible @adminjs/fastify@3.0.1, its
//    router registers its own bundled @fastify/multipart. The main app
//    already registers @fastify/multipart itself (for merchant photo
//    uploads) — two registrations on one Fastify instance collide with
//    "FastifyError: The decorator 'multipartErrors' has already been
//    added!" and crash the process.
//
// A separate process sidesteps both, at the cost of a second `npm run`.
import AdminJS from "adminjs";
import Adapter, { Database, Resource } from "@adminjs/sql";
import { env } from "../env.js";

AdminJS.registerAdapter({ Database, Resource });

// AdminJS's SQL adapter connects on its own — it does not reuse the app's
// mysql2 pool (db/connection.js). Fine for an internal tool hit by a
// handful of admins, not worth sharing a pool across processes for.
async function connectDatabase() {
  return new Adapter("mysql2", {
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
  }).init();
}

// Hides a merchant's bcrypt hash from the admin UI entirely — there is
// never a legitimate reason to display it, even to a trusted admin.
const HIDDEN = { isVisible: false };

// `isVisible: false` (HIDDEN, above) only hides a field from the rendered
// UI — AdminJS's BaseRecord.toJSON() always serializes the *full* raw
// params object into every API response, verified empirically: a merchant's
// bcrypt hash came back over the wire regardless of isVisible, both from
// the merchants resource directly and — worse — inlined wherever AdminJS
// auto-populates the businesses -> merchant_id foreign key relation. This
// scrubs it from both shapes an action response takes (`record`, or
// `records` on a list/search), including one level of populated relation.
function stripSensitiveFields(response, fields) {
  const scrub = (record) => {
    if (!record) return;
    for (const field of fields) delete record.params?.[field];
    for (const related of Object.values(record.populated || {})) scrub(related);
  };
  if (response?.record) scrub(response.record);
  if (Array.isArray(response?.records)) response.records.forEach(scrub);
  return response;
}

const stripMerchantPasswordHash = async (response) =>
  stripSensitiveFields(response, ["password_hash"]);

const SCRUB_PASSWORD_HOOKS = {
  list: { after: stripMerchantPasswordHash },
  show: { after: stripMerchantPasswordHash },
  edit: { after: stripMerchantPasswordHash },
  search: { after: stripMerchantPasswordHash },
};

export async function buildAdmin() {
  const db = await connectDatabase();

  const admin = new AdminJS({
    rootPath: "/admin",
    branding: {
      companyName: "KiliPicks",
      withMadeWithLove: false,
    },
    resources: [
      {
        resource: db.table("merchants"),
        options: {
          navigation: { name: "Accounts" },
          listProperties: ["full_name", "email", "status", "created_at"],
          properties: {
            password_hash: HIDDEN,
          },
          actions: {
            ...SCRUB_PASSWORD_HOOKS,
            edit: { isAccessible: false },
            new: { isAccessible: false },
            delete: { isAccessible: false },
            suspend: {
              actionType: "record",
              icon: "Lock",
              guard: "Suspend this merchant? They will no longer be able to sign in.",
              after: stripMerchantPasswordHash,
              handler: async (request, _response, context) => {
                const { record, currentAdmin } = context;
                await record.update({ status: "suspended" });
                return {
                  record: record.toJSON(currentAdmin),
                  notice: { message: "Merchant suspended.", type: "success" },
                };
              },
            },
            reactivate: {
              actionType: "record",
              icon: "Unlock",
              guard: "Reactivate this merchant's account?",
              after: stripMerchantPasswordHash,
              handler: async (request, _response, context) => {
                const { record, currentAdmin } = context;
                await record.update({ status: "active" });
                return {
                  record: record.toJSON(currentAdmin),
                  notice: { message: "Merchant reactivated.", type: "success" },
                };
              },
            },
          },
        },
      },
      {
        resource: db.table("businesses"),
        options: {
          navigation: { name: "Accounts" },
          listProperties: ["name", "category_id", "area", "publication_status", "booking_enabled", "created_at"],
          editProperties: [
            "name", "category_id", "subcategory", "area", "phone", "email",
            "verified", "recommended", "featured", "booking_enabled",
            "booking_method", "partnership_status", "publication_status",
            "limited_listing",
          ],
          properties: {
            // Onboarding-owned free-text/JSON fields — reviewable here but
            // not meant to be hand-edited by an admin day to day.
            hours: { type: "textarea" },
            positioning: { type: "textarea" },
          },
          actions: {
            // Businesses aren't the owner of password_hash, but AdminJS
            // auto-populates the merchant_id -> merchants relation inline —
            // without these, a business's own list/show/search response
            // carries its owning merchant's bcrypt hash right along with it.
            ...SCRUB_PASSWORD_HOOKS,
            delete: { isAccessible: false },
            publish: {
              actionType: "record",
              icon: "CheckCircle",
              guard:
                "Publish this business? It becomes visible in consumer search immediately (within the catalog's cache TTL, up to 5 minutes).",
              after: stripMerchantPasswordHash,
              handler: async (request, _response, context) => {
                const { record, currentAdmin } = context;
                await record.update({ publication_status: "published", limited_listing: 0 });
                return {
                  record: record.toJSON(currentAdmin),
                  notice: { message: "Business published.", type: "success" },
                };
              },
            },
            unpublish: {
              actionType: "record",
              icon: "XCircle",
              guard: "Unpublish this business? It disappears from consumer search immediately.",
              after: stripMerchantPasswordHash,
              handler: async (request, _response, context) => {
                const { record, currentAdmin } = context;
                await record.update({ publication_status: "hidden" });
                return {
                  record: record.toJSON(currentAdmin),
                  notice: { message: "Business unpublished.", type: "success" },
                };
              },
            },
          },
        },
      },
      {
        resource: db.table("services"),
        options: {
          navigation: { name: "Accounts" },
          listProperties: ["name", "business_id", "category_id", "price", "active", "booking_enabled"],
          editProperties: ["active"],
          actions: {
            new: { isAccessible: false },
            delete: { isAccessible: false },
          },
        },
      },
      {
        resource: db.table("availability_requests"),
        options: {
          navigation: { name: "Requests" },
          listProperties: [
            "consumer_name", "whatsapp_number", "preferred_date",
            "preferred_time", "status", "created_at",
          ],
          sort: { sortBy: "created_at", direction: "desc" },
          editProperties: ["status"],
          actions: {
            new: { isAccessible: false },
            delete: { isAccessible: false },
          },
        },
      },
      {
        resource: db.table("looks"),
        options: {
          navigation: { name: "Requests" },
          editProperties: ["status"],
          actions: {
            new: { isAccessible: false },
            delete: { isAccessible: false },
          },
        },
      },
      {
        resource: db.table("media_uploads"),
        options: {
          navigation: { name: "Requests" },
          actions: {
            new: { isAccessible: false },
            edit: { isAccessible: false },
            delete: { isAccessible: false },
          },
        },
      },
      {
        resource: db.table("analytics_events"),
        options: {
          navigation: { name: "System" },
          sort: { sortBy: "timestamp", direction: "desc" },
          actions: {
            new: { isAccessible: false },
            edit: { isAccessible: false },
            delete: { isAccessible: false },
          },
        },
      },
      {
        resource: db.table("app_config"),
        options: {
          navigation: { name: "System" },
          editProperties: ["value"],
        },
      },
    ],
  });

  return admin;
}
