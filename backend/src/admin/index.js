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
import { execute, queryOne } from "../db/connection.js";
import { deleteUpload } from "../lib/storage.js";
import { notifyBusinessReview } from "../services/notifications.js";
import { refreshBusinessRating } from "../services/reviews.js";

AdminJS.registerAdapter({ Database, Resource });

// AdminJS's SQL adapter connects on its own — it does not reuse the app's
// pg pool (db/connection.js). Fine for an internal tool hit by a
// handful of admins, not worth sharing a pool across processes for.
// `database` is only a label here (the adapter insists on one); the real
// target comes from the connection string.
async function connectDatabase() {
  return new Adapter("postgresql", {
    connectionString: env.databaseUrl,
    ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
    database: "postgres",
    schema: "public",
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

// Look, don't touch: for tables the panel is only there to inspect.
const READ_ONLY = {
  new: { isAccessible: false },
  edit: { isAccessible: false },
  delete: { isAccessible: false },
};

// A notification failing must never undo (or mask) the admin action that
// triggered it.
async function notifySafely(send) {
  try {
    await send();
    return true;
  } catch (err) {
    console.error("admin: notification failed", err);
    return false;
  }
}

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
        resource: db.table("users"),
        options: {
          navigation: { name: "Accounts" },
          listProperties: ["full_name", "email", "status", "created_at"],
          // status changes only through Suspend / Reactivate below.
          editProperties: ["full_name", "email"],
          properties: {
            password_hash: HIDDEN,
          },
          actions: {
            ...SCRUB_PASSWORD_HOOKS,
            new: { isAccessible: false },
            delete: { isAccessible: false },
            suspend: {
              actionType: "record",
              icon: "Lock",
              guard:
                "Suspend this customer? They are signed out everywhere and can no longer log in, book or write reviews. Their existing bookings are left as they are.",
              after: stripMerchantPasswordHash,
              handler: async (request, _response, context) => {
                const { record, currentAdmin } = context;
                await record.update({ status: "suspended" });
                return {
                  record: record.toJSON(currentAdmin),
                  notice: { message: "Customer suspended.", type: "success" },
                };
              },
            },
            reactivate: {
              actionType: "record",
              icon: "Unlock",
              guard: "Reactivate this customer's account?",
              after: stripMerchantPasswordHash,
              handler: async (request, _response, context) => {
                const { record, currentAdmin } = context;
                await record.update({ status: "active" });
                return {
                  record: record.toJSON(currentAdmin),
                  notice: { message: "Customer reactivated.", type: "success" },
                };
              },
            },
            // Profile photos aren't in media_uploads (they're a single
            // field on the user), so they get their own removal here.
            removePhoto: {
              actionType: "record",
              icon: "Trash2",
              guard: "Remove this customer's profile photo? It also disappears from their reviews.",
              after: stripMerchantPasswordHash,
              handler: async (request, _response, context) => {
                const { record, currentAdmin } = context;
                const url = record.params.photo_url;
                if (!url) {
                  return {
                    record: record.toJSON(currentAdmin),
                    notice: { message: "This customer has no profile photo.", type: "info" },
                  };
                }
                await record.update({ photo_url: null });
                // Stored as "<uploadsBaseUrl>/users/<id>/<file>" locally.
                const localPath = url.startsWith(`${env.uploadsBaseUrl}/`)
                  ? url.slice(env.uploadsBaseUrl.length + 1)
                  : null;
                await deleteUpload({ filePath: localPath, publicUrl: url });
                return {
                  record: record.toJSON(currentAdmin),
                  notice: { message: "Profile photo removed.", type: "success" },
                };
              },
            },
          },
        },
      },
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
              guard:
                "Suspend this merchant? They lose access to their dashboard, and their business disappears from customer search and stops taking bookings (search can take up to 5 minutes to update).",
              after: stripMerchantPasswordHash,
              handler: async (request, _response, context) => {
                const { record, currentAdmin } = context;
                await record.update({ status: "suspended" });
                return {
                  record: record.toJSON(currentAdmin),
                  notice: {
                    message: "Merchant suspended. Their business is now hidden and can't be booked.",
                    type: "success",
                  },
                };
              },
            },
            reactivate: {
              actionType: "record",
              icon: "Unlock",
              guard:
                "Reactivate this merchant's account? A business that was published before the suspension goes live again.",
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
          // The review queue: newest submissions first, and "Review status"
          // in the Filter drawer narrows to "Awaiting review".
          listProperties: [
            "name", "review_status", "submitted_at", "publication_status",
            "category_id", "area", "booking_enabled",
          ],
          sort: { sortBy: "submitted_at", direction: "desc" },
          editProperties: [
            "name", "category_id", "subcategory", "area", "phone", "email",
            "verified", "recommended", "featured", "booking_enabled",
            "booking_method", "partnership_status", "publication_status",
            "limited_listing", "review_note",
          ],
          properties: {
            review_status: {
              availableValues: [
                { value: "awaiting_review", label: "Awaiting review" },
                { value: "changes_requested", label: "Changes requested" },
                { value: "approved", label: "Approved" },
                { value: "not_submitted", label: "Not submitted" },
              ],
            },
            // The message the merchant sees when changes are requested —
            // written here (Edit), then sent with "Request changes".
            review_note: { type: "textarea" },
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

                // Publishing also switches booking on (below), so a business
                // with nothing to book would go live as a dead end: visible
                // in search, with a Book button that leads nowhere. Unlike
                // the "missing" notes further down, this one blocks.
                const bookable = await queryOne(
                  "SELECT COUNT(*) AS count FROM services WHERE business_id = ? AND active = 1 AND booking_enabled = 1",
                  [record.params.id],
                );
                if (Number(bookable?.count ?? 0) === 0) {
                  return {
                    record: record.toJSON(currentAdmin),
                    notice: {
                      message:
                        "Not published: this business has no active, bookable services. Ask the merchant to add at least one service first.",
                      type: "error",
                    },
                  };
                }

                // The consumer catalog only gates on publication_status
                // (see backend/src/services/catalog.js) — nothing else stops
                // an incomplete listing from going live. This doesn't block
                // publish (an admin may have a good reason to override), it
                // just surfaces what a client won't be able to see.
                const missing = [];
                if (!record.params.hours?.trim()) missing.push("hours");
                if (!record.params.full_address?.trim()) missing.push("address");
                if (!record.params.cover_url?.trim()) missing.push("cover photo");

                // booking_enabled defaults to 0 and nothing else in this flow
                // ever flips it — without setting it here too, a freshly
                // published business stays stuck behind the "must be a
                // signed KiliPicks partner" gate in app/booking/[providerId].tsx
                // even after an admin publishes it, with no visible admin
                // signal that a second field still needs editing.
                const firstApproval = record.params.review_status !== "approved";
                await record.update({
                  publication_status: "published",
                  limited_listing: 0,
                  booking_enabled: 1,
                  review_status: "approved",
                  review_note: null,
                  reviewed_at: new Date(),
                });
                // Only on the approval itself — re-publishing after a
                // temporary unpublish isn't news to the merchant.
                const told =
                  firstApproval &&
                  (await notifySafely(() => notifyBusinessReview(record.params, "approved")));
                return {
                  record: record.toJSON(currentAdmin),
                  notice: {
                    message: [
                      "Business published.",
                      told ? "The merchant has been notified." : "",
                      missing.length > 0 ? `Note: missing ${missing.join(", ")}.` : "",
                    ]
                      .filter(Boolean)
                      .join(" "),
                    type: "success",
                  },
                };
              },
            },
            // The "reject" path. The reason is the Review note field (Edit
            // first, then this) — AdminJS record actions can't prompt for
            // free text without a custom bundled component.
            requestChanges: {
              actionType: "record",
              icon: "MessageSquare",
              guard:
                "Send this business back to the merchant with the Review note as the reason? If it is live it is also taken down.",
              after: stripMerchantPasswordHash,
              handler: async (request, _response, context) => {
                const { record, currentAdmin } = context;
                const note = record.params.review_note?.trim();
                if (!note) {
                  return {
                    record: record.toJSON(currentAdmin),
                    notice: {
                      message:
                        "Nothing sent: write what needs changing in the Review note field first (Edit), then use Request changes.",
                      type: "error",
                    },
                  };
                }
                await record.update({
                  review_status: "changes_requested",
                  reviewed_at: new Date(),
                  ...(record.params.publication_status === "published"
                    ? { publication_status: "hidden" }
                    : {}),
                });
                const told = await notifySafely(() =>
                  notifyBusinessReview(record.params, "changes_requested", note),
                );
                return {
                  record: record.toJSON(currentAdmin),
                  notice: {
                    message: told
                      ? "Changes requested. The merchant has been notified with your note."
                      : "Changes requested. The merchant will see your note on their profile.",
                    type: "success",
                  },
                };
              },
            },
            unpublish: {
              actionType: "record",
              icon: "XCircle",
              guard:
                "Unpublish this business? It disappears from customer search (within 5 minutes) and can no longer be booked.",
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
        // Every booking, however it was made — read-only, for support and
        // disputes. Changing one is the merchant's (or customer's) job in
        // the app, where the other side gets notified.
        resource: db.table("bookings"),
        options: {
          navigation: { name: "Bookings" },
          listProperties: [
            "customer_name", "service_name", "business_id", "date", "time",
            "status", "cancelled_by", "source", "created_at",
          ],
          sort: { sortBy: "created_at", direction: "desc" },
          actions: READ_ONLY,
        },
      },
      {
        // What customers and merchants were told, and when.
        resource: db.table("notifications"),
        options: {
          navigation: { name: "Bookings" },
          listProperties: ["user_id", "type", "title", "read_at", "created_at"],
          sort: { sortBy: "created_at", direction: "desc" },
          actions: READ_ONLY,
        },
      },
      {
        // Transactions merchants entered by hand on their Sales tab.
        // (Sales from bookings are the confirmed/completed rows above.)
        resource: db.table("sales_transactions"),
        options: {
          navigation: { name: "Bookings" },
          listProperties: ["business_id", "type", "amount", "description", "method", "occurred_on"],
          sort: { sortBy: "created_at", direction: "desc" },
          actions: READ_ONLY,
        },
      },
      {
        // Consumer reviews — moderation only: flip status to "hidden" to pull
        // one from the public page. The business's rating is recomputed after
        // every edit so the catalog stops counting a hidden review.
        resource: db.table("reviews"),
        options: {
          navigation: { name: "Moderation" },
          listProperties: ["business_id", "rating", "body", "status", "created_at"],
          sort: { sortBy: "created_at", direction: "desc" },
          editProperties: ["status"],
          actions: {
            new: { isAccessible: false },
            delete: { isAccessible: false },
            edit: {
              after: async (response) => {
                const businessId = response?.record?.params?.business_id;
                if (businessId) await refreshBusinessRating(businessId);
                return response;
              },
            },
          },
        },
      },
      {
        resource: db.table("media_uploads"),
        options: {
          navigation: { name: "Moderation" },
          listProperties: ["public_url", "purpose", "business_id", "merchant_id", "created_at"],
          sort: { sortBy: "created_at", direction: "desc" },
          actions: {
            ...READ_ONLY,
            // Takes a photo down everywhere it's used, then deletes it.
            // Order matters: references first, so nothing points at a file
            // that's already gone.
            removePhoto: {
              actionType: "record",
              icon: "Trash2",
              guard:
                "Remove this photo? It is taken off the business's cover, logo, gallery and any service using it, and the file is deleted. This can't be undone. Customer search can take up to 5 minutes to update.",
              handler: async (request, _response, context) => {
                const { record, resource, h } = context;
                const url = record.params.public_url;

                // gallery_urls is a JSON array of URL strings. If the cover
                // was this photo, the next gallery photo takes its place
                // (the app treats the first gallery photo as the cover).
                await execute(
                  `UPDATE businesses
                   SET cover_url = CASE
                         WHEN cover_url = ? THEN (gallery_urls - ?::text) ->> 0
                         ELSE cover_url
                       END,
                       logo_url = CASE WHEN logo_url = ? THEN NULL ELSE logo_url END,
                       gallery_urls = gallery_urls - ?::text
                   WHERE cover_url = ? OR logo_url = ? OR gallery_urls @> ?::jsonb`,
                  [url, url, url, url, url, url, JSON.stringify([url])],
                );
                await execute("UPDATE services SET image_url = NULL WHERE image_url = ?", [url]);
                const fileDeleted = await deleteUpload({
                  filePath: record.params.file_path,
                  publicUrl: url,
                });
                await execute("DELETE FROM media_uploads WHERE id = ?", [record.params.id]);

                return {
                  redirectUrl: h.resourceUrl({ resourceId: resource.id() }),
                  notice: {
                    message: fileDeleted
                      ? "Photo removed from the listing and deleted."
                      : "Photo removed from the listing. The stored file could not be deleted — remove it from storage by hand.",
                    type: fileDeleted ? "success" : "info",
                  },
                };
              },
            },
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
          actions: { delete: { isAccessible: false } },
        },
      },
    ],
  });

  return admin;
}
