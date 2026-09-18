import { execute, query, queryOne } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest, notFound } from "../lib/http-errors.js";
import { invalidateCatalogCache, serializeProvider, serializeService } from "./catalog.js";

// Mirrors the category taxonomy the rest of the catalog uses (see
// src/utils/categories.ts on the mobile side) — categoryId values coming out
// of onboarding must be one of these, or the business becomes its own orphan
// category chip instead of joining the one customers already browse by.
const BEAUTY_CATEGORY_IDS = new Set(["hair", "wigs", "nails", "facials", "makeup", "barbering"]);
const WELLNESS_CATEGORY_IDS = new Set(["spa", "fitness", "pilates", "yoga", "recovery"]);
const DEFAULT_CATEGORY_ID = "spa";

function industryForCategory(categoryId) {
  if (BEAUTY_CATEGORY_IDS.has(categoryId)) return "beauty";
  if (WELLNESS_CATEGORY_IDS.has(categoryId)) return "wellness";
  // Unrecognized categoryId (shouldn't happen once the client only ever
  // sends canonical ids) — wellness is as good a default as beauty here,
  // matches the old heuristic's fallback.
  return "wellness";
}

function safeJson(val, fallback = []) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "biz"
  );
}

export function serializeMerchantBusiness(row) {
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id,
    slug: row.slug,
    name: row.name,
    industry: row.industry,
    categoryId: row.category_id,
    subcategory: row.subcategory,
    email: row.email,
    phone: row.phone,
    area: row.area,
    fullAddress: row.full_address,
    latitude: row.latitude,
    longitude: row.longitude,
    locationType: row.location_type === "MOBILE_SERVICE" ? "mobile" : "physical",
    travelRadius: row.travel_radius ?? 15,
    radiusEnabled: Boolean(row.travel_radius),
    serviceAreas: safeJson(row.service_areas, []),
    hours: row.hours || "",
    activePreset: row.active_preset ?? "Mon – Fri, 9 – 6",
    positioning: row.positioning || "",
    about: row.about || row.positioning || "",
    coverUrl: row.cover_url,
    galleryUrls: safeJson(row.gallery_urls, []),
    onboardingStep: row.onboarding_step ?? 1,
    submittedAt: row.submitted_at,
    publicationStatus: row.publication_status,
    limitedListing: Boolean(row.limited_listing),
    bookingEnabled: Boolean(row.booking_enabled),
    verified: Boolean(row.verified),
    rating: row.rating !== null && row.rating !== undefined ? Number(row.rating) : null,
    verifiedCount: row.verified_count ? Number(row.verified_count) : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findBusinessByMerchantId(merchantId) {
  const row = await queryOne("SELECT * FROM businesses WHERE merchant_id = ?", [merchantId]);
  return row ? serializeMerchantBusiness(row) : null;
}

// Merges a phone/email pair into whatever public_contacts already has,
// rather than overwriting it — website/instagram/tiktok aren't collected by
// onboarding today but shouldn't be clobbered if they're ever set another
// way. This is what buildContactChannels() on the mobile side actually
// reads for the Email/Website/Instagram/TikTok buttons; the flat phone/email
// columns only cover Call/WhatsApp there.
function buildPublicContacts(existingRow, { phone, email }) {
  const current = safeJson(existingRow?.public_contacts, {});
  const next = { ...current };
  if (phone) next.phone = phone;
  if (email) next.email = email;
  return JSON.stringify(next);
}

export async function saveStep1(merchantId, { name, category, description, phone, email }) {
  if (!name || name.trim().length === 0) {
    throw badRequest("Business name is required.");
  }

  const existing = await queryOne("SELECT * FROM businesses WHERE merchant_id = ?", [merchantId]);
  const trimmedName = name.trim();
  const categoryId = category?.trim() || DEFAULT_CATEGORY_ID;
  const industry = industryForCategory(categoryId);
  const desc = description?.trim() || "";
  const contactPhone = phone?.trim() || "";
  const contactEmail = email?.trim() || null;
  const publicContactsJson = buildPublicContacts(existing, { phone: contactPhone, email: contactEmail });

  if (existing) {
    await execute(
      `UPDATE businesses
       SET name = ?, category_id = ?, industry = ?, positioning = ?, about = ?,
           phone = ?, email = ?, public_contacts = ?, onboarding_step = GREATEST(onboarding_step, 1)
       WHERE id = ?`,
      [trimmedName, categoryId, industry, desc, desc, contactPhone, contactEmail, publicContactsJson, existing.id]
    );
    invalidateCatalogCache();
    const updated = await queryOne("SELECT * FROM businesses WHERE id = ?", [existing.id]);
    return serializeMerchantBusiness(updated);
  }

  const id = newId();
  const slug = `${slugify(trimmedName)}-${id.slice(-6).toLowerCase()}`;

  try {
    await execute(
      `INSERT INTO businesses (
        id, merchant_id, slug, name, industry, category_id,
        email, phone, public_contacts, area, full_address, latitude, longitude,
        location_type, hours, positioning, about,
        publication_status, limited_listing, onboarding_step
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        'FIXED_VENUE', '', ?, ?,
        'draft', 1, 1
      )`,
      [
        id,
        merchantId,
        slug,
        trimmedName,
        industry,
        categoryId,
        contactEmail,
        contactPhone,
        publicContactsJson,
        "Nairobi",
        "",
        -1.2921,
        36.8219,
        desc,
        desc,
      ]
    );
  } catch (err) {
    // businesses.merchant_id is UNIQUE (migration 016) specifically to close
    // this race: two near-simultaneous first-saves (double tap, or a client
    // retry after a slow response that actually succeeded) can both reach
    // here having seen `existing` as null. Whichever loses the race falls
    // back to updating the row the winner just created, instead of a raw
    // 500 — same outcome the caller would get if it had seen `existing` in
    // the first place.
    if (err?.code === "ER_DUP_ENTRY") {
      const winner = await queryOne("SELECT * FROM businesses WHERE merchant_id = ?", [merchantId]);
      if (winner) {
        await execute(
          `UPDATE businesses
           SET name = ?, category_id = ?, industry = ?, positioning = ?, about = ?,
               phone = ?, email = ?, public_contacts = ?, onboarding_step = GREATEST(onboarding_step, 1)
           WHERE id = ?`,
          [trimmedName, categoryId, industry, desc, desc, contactPhone, contactEmail, publicContactsJson, winner.id]
        );
        invalidateCatalogCache();
        const updated = await queryOne("SELECT * FROM businesses WHERE id = ?", [winner.id]);
        return serializeMerchantBusiness(updated);
      }
    }
    throw err;
  }

  invalidateCatalogCache();
  const created = await queryOne("SELECT * FROM businesses WHERE id = ?", [id]);
  return serializeMerchantBusiness(created);
}

export async function saveStep2(merchantId, { address, area, locationType, radius, radiusEnabled }) {
  const existing = await queryOne("SELECT * FROM businesses WHERE merchant_id = ?", [merchantId]);
  if (!existing) {
    throw badRequest("Step 1 must be completed before Step 2.");
  }

  const fullAddress = address?.trim() || "";
  const neighborhood = area?.trim() || (fullAddress ? fullAddress.split(",")[0].trim() : "Nairobi");
  const locType = locationType === "mobile" ? "MOBILE_SERVICE" : "FIXED_VENUE";
  const travelRad = radiusEnabled ? (Number(radius) || 15) : 0;
  const serviceAreasJson = JSON.stringify([{ radiusMiles: travelRad, enabled: Boolean(radiusEnabled) }]);

  await execute(
    `UPDATE businesses
     SET full_address = ?, area = ?, location_type = ?, travel_radius = ?, service_areas = ?,
         onboarding_step = GREATEST(onboarding_step, 2)
     WHERE id = ?`,
    [fullAddress, neighborhood, locType, travelRad, serviceAreasJson, existing.id]
  );

  invalidateCatalogCache();
  const updated = await queryOne("SELECT * FROM businesses WHERE id = ?", [existing.id]);
  return serializeMerchantBusiness(updated);
}

export async function saveStep3(merchantId, { photos, activePreset, days, hoursText }) {
  const existing = await queryOne("SELECT * FROM businesses WHERE merchant_id = ?", [merchantId]);
  if (!existing) {
    throw badRequest("Step 1 and Step 2 must be completed before Step 3.");
  }

  // `photos` comes from the client as { uri, label } objects (see
  // GalleryPhoto in src/api/merchant.ts) — the public catalog schema
  // requires gallery_urls to be plain strings, so unwrap .uri here rather
  // than persisting the picker's object shape straight to the DB.
  const gallery = (Array.isArray(photos) ? photos : [])
    .map((p) => (typeof p === "string" ? p : p?.uri))
    .filter((uri) => typeof uri === "string" && uri.length > 0);
  const coverUrl = gallery.length > 0 ? gallery[0] : existing.cover_url;
  const galleryJson = JSON.stringify(gallery);

  let formattedHours = hoursText || "";
  if (!formattedHours && Array.isArray(days)) {
    formattedHours = days
      .map((d) => `${d.name}: ${d.open ? `${d.from || "9:00 AM"} – ${d.to || "6:00 PM"}` : "Closed"}`)
      .join("\n");
  }

  await execute(
    `UPDATE businesses
     SET gallery_urls = ?, cover_url = ?, hours = ?, active_preset = ?,
         onboarding_step = GREATEST(onboarding_step, 3)
     WHERE id = ?`,
    [galleryJson, coverUrl, formattedHours, activePreset || "Mon – Fri, 9 – 6", existing.id]
  );

  invalidateCatalogCache();
  const updated = await queryOne("SELECT * FROM businesses WHERE id = ?", [existing.id]);
  return serializeMerchantBusiness(updated);
}

export async function submitOnboarding(merchantId) {
  const existing = await queryOne("SELECT * FROM businesses WHERE merchant_id = ?", [merchantId]);
  if (!existing) {
    throw badRequest("No business found to submit.");
  }

  await execute(
    `UPDATE businesses
     SET publication_status = 'draft',
         limited_listing = 1,
         submitted_at = CURRENT_TIMESTAMP(3),
         onboarding_step = 4
     WHERE id = ?`,
    [existing.id]
  );

  invalidateCatalogCache();
  const updated = await queryOne("SELECT * FROM businesses WHERE id = ?", [existing.id]);
  return serializeMerchantBusiness(updated);
}

export async function updateBusiness(merchantId, updates) {
  const existing = await queryOne("SELECT * FROM businesses WHERE merchant_id = ?", [merchantId]);
  if (!existing) {
    throw badRequest("No business found for this merchant.");
  }

  const allowed = [
    "name", "about", "positioning", "hours", "phone", "email",
    "full_address", "area", "cover_url", "gallery_urls", "booking_enabled"
  ];
  const setClauses = [];
  const values = [];

  for (const [key, val] of Object.entries(updates)) {
    const colName = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    if (allowed.includes(colName)) {
      setClauses.push(`${colName} = ?`);
      values.push(typeof val === "object" ? JSON.stringify(val) : val);
    }
  }

  // Keep public_contacts (what buildContactChannels() actually reads for
  // Email/Website/Instagram/TikTok) in sync whenever phone/email change
  // here too — same reasoning as saveStep1's buildPublicContacts.
  if ("phone" in updates || "email" in updates) {
    setClauses.push("public_contacts = ?");
    values.push(
      buildPublicContacts(existing, {
        phone: updates.phone ?? existing.phone,
        email: updates.email ?? existing.email,
      }),
    );
  }

  if (setClauses.length > 0) {
    values.push(existing.id);
    await execute(`UPDATE businesses SET ${setClauses.join(", ")} WHERE id = ?`, values);
    invalidateCatalogCache();
  }

  const updated = await queryOne("SELECT * FROM businesses WHERE id = ?", [existing.id]);
  return serializeMerchantBusiness(updated);
}

// Renders the merchant's own business through the exact same serializer the
// public catalog uses, regardless of publication_status — this is what lets
// app/provider/[id].tsx show a merchant a true preview of their listing
// (including a still-in-review draft) without waiting for an admin publish.
export async function getBusinessPreview(merchantId) {
  const row = await queryOne("SELECT * FROM businesses WHERE merchant_id = ?", [merchantId]);
  if (!row) {
    throw notFound("business_not_found", "Complete onboarding before previewing your listing.");
  }

  const services = await query(
    "SELECT * FROM services WHERE business_id = ? AND active = 1 ORDER BY sort_order ASC, created_at ASC",
    [row.id],
  );
  const serviceIdsByBusiness = new Map([[row.id, services.map((s) => s.id)]]);
  const serviceImagesByBusiness = new Map([
    [row.id, services.map((s) => s.image_url).filter(Boolean)],
  ]);

  return {
    provider: serializeProvider(row, serviceIdsByBusiness, serviceImagesByBusiness),
    services: services.map(serializeService),
  };
}
