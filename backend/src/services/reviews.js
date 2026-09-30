import { execute, query, queryOne } from "../db/connection.js";
import { findLiveBusiness } from "./business-visibility.js";
import { newId } from "../lib/ids.js";
import { badRequest, forbidden, notFound } from "../lib/http-errors.js";
import { invalidateCatalogCache } from "./catalog.js";

const MAX_BODY_LENGTH = 1000;
const LIST_LIMIT = 50;

// "Amara Wanjiku" -> "Amara W." — reviews are public, so never show a
// consumer's full surname.
function displayName(fullName) {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "KiliPicks user";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function serializeReview(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    rating: row.rating,
    body: row.body ?? "",
    authorName: displayName(row.full_name),
    authorPhotoUrl: row.photo_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requirePublishedBusiness(businessId) {
  const business = await findLiveBusiness(businessId);
  if (!business) throw notFound("business_not_found", "That business could not be found.");
  return business;
}

async function summaryFor(businessId) {
  const row = await queryOne(
    `SELECT COUNT(*) AS count, ROUND(AVG(rating)::numeric, 2) AS average
     FROM reviews WHERE business_id = ? AND status = 'published'`,
    [businessId],
  );
  return { count: row?.count ?? 0, average: row?.average ?? null };
}

// Only checks the business exists (not that it's published), so the
// merchant's own storefront preview can show its reviews too. Writing still
// requires a published business.
export async function listBusinessReviews(businessId) {
  const business = await queryOne("SELECT id FROM businesses WHERE id = ?", [businessId]);
  if (!business) throw notFound("business_not_found", "That business could not be found.");
  const rows = await query(
    `SELECT r.*, u.full_name, u.photo_url
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.business_id = ? AND r.status = 'published'
     ORDER BY r.created_at DESC
     LIMIT ${LIST_LIMIT}`,
    [businessId],
  );
  return { reviews: rows.map(serializeReview), summary: await summaryFor(businessId) };
}

export async function getOwnReview(userId, businessId) {
  const row = await queryOne(
    `SELECT r.*, u.full_name, u.photo_url
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.business_id = ? AND r.user_id = ?`,
    [businessId, userId],
  );
  return row ? { ...serializeReview(row), status: row.status } : null;
}

// Create or edit the signed-in consumer's review of a business.
export async function upsertReview(userId, businessId, input) {
  const business = await requirePublishedBusiness(businessId);

  // A business owner reviewing their own listing would skew the rating.
  const owner = await queryOne("SELECT owner_user_id FROM merchants WHERE id = ?", [
    business.merchant_id,
  ]);
  if (owner?.owner_user_id === userId) {
    throw forbidden("You can't review your own business.", "own_business");
  }

  const rating = Number(input?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badRequest("invalid_rating", "Choose a rating from 1 to 5 stars.", ["rating"]);
  }
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  if (body.length > MAX_BODY_LENGTH) {
    throw badRequest(
      "review_too_long",
      `Keep your review under ${MAX_BODY_LENGTH} characters.`,
      ["body"],
    );
  }

  // Editing a review keeps its moderation status — hiding one and then
  // letting the author "edit" it back into view would defeat the point.
  await execute(
    `INSERT INTO reviews (id, business_id, user_id, rating, body)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (business_id, user_id)
     DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body`,
    [newId(), businessId, userId, rating, body],
  );

  await refreshBusinessRating(businessId);
  return getOwnReview(userId, businessId);
}

// Keeps the catalog's rating / "(N reviews)" count in step with the
// published reviews. With none published the rating goes back to null.
export async function refreshBusinessRating(businessId) {
  const { count, average } = await summaryFor(businessId);
  await execute("UPDATE businesses SET rating = ?, verified_count = ? WHERE id = ?", [
    count > 0 ? average : null,
    count,
    businessId,
  ]);
  invalidateCatalogCache();
}
