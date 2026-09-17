import { query } from "../db/connection.js";
import { computeOpenNow } from "./open-now.js";

// Phase Zero: live query with a 5-minute in-memory cache, not a pre-built
// snapshot — at 50 providers / 500 users the snapshot pattern is pure
// overhead. Route handlers that mutate businesses/services/looks must call
// invalidateCatalogCache() so the change is visible within one request
// instead of waiting out the TTL.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = null;
let cacheBuiltAt = 0;

export function invalidateCatalogCache() {
  cache = null;
}

export async function getCatalogSnapshot() {
  if (cache && Date.now() - cacheBuiltAt < CACHE_TTL_MS) return cache;
  cache = await buildCatalogSnapshot();
  cacheBuiltAt = Date.now();
  return cache;
}

// mysql2 auto-parses JSON-typed columns (highlights, facilities, gallery_urls,
// public_contacts, payment_settings, service_areas) into JS values already —
// no manual JSON.parse needed here.

export function serializeProvider(row, serviceIdsByBusiness) {
  const provider = {
    id: row.id,
    slug: row.slug,
    industry: row.industry,
    categoryId: row.category_id,
    subcategory: row.subcategory ?? null,
    name: row.name,
    area: row.area,
    distance: "", // no geolocation in Phase Zero
    mainOffering: row.main_offering,
    verified: Boolean(row.verified),
    verifiedCount: row.verified_count,
    openNow: computeOpenNow(row.hours),
    cover: row.cover_url ?? "",
    address: row.full_address,
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      fullAddress: row.full_address,
      area: row.area,
      city: "Nairobi",
      locationType: row.location_type,
      serviceAreas: row.service_areas ?? [],
      landmark: row.landmark ?? "",
      parkingAvailable: Boolean(row.parking_available),
    },
    paymentSettings: {
      allowPayAtVenue: false,
      requiresDeposit: false,
      instantConfirmation: false,
      acceptedPaymentMethods: [],
      ...(row.payment_settings ?? {}),
    },
    hours: row.hours ?? "",
    phone: row.phone,
    serviceIds: serviceIdsByBusiness.get(row.id) ?? [],
    specialistIds: [], // no professionals in Phase Zero
    highlights: row.highlights ?? [],
    facilities: row.facilities ?? [],
    wouldReturn: row.would_return,
    trustMetric: row.trust_metric,
    partnershipStatus: row.partnership_status,
    publicationStatus: row.publication_status,
    limitedListing: Boolean(row.limited_listing),
    bookingEnabled: Boolean(row.booking_enabled),
    bookingMethod: row.booking_method,
    recommended: Boolean(row.recommended),
    featured: Boolean(row.featured),
    gallery: row.gallery_urls ?? [],
    publicContacts: row.public_contacts ?? {},
  };

  if (row.rating != null) provider.rating = row.rating;
  if (row.starting_price != null) provider.startingPrice = row.starting_price;
  if (row.next_available != null) provider.nextAvailable = row.next_available;
  if (row.positioning != null) provider.positioning = row.positioning;
  if (row.about != null) provider.about = row.about;
  if (row.team != null) provider.team = row.team;
  if (row.reviews != null) provider.reviews = row.reviews;
  if (row.portfolio != null) provider.portfolio = row.portfolio;
  if (row.other_section != null) provider.otherSection = row.other_section;

  return provider;
}

export function serializeService(row) {
  const service = {
    id: row.id,
    providerId: row.business_id,
    categoryId: row.category_id,
    industry: row.industry,
    name: row.name,
    description: row.description ?? "",
    price: row.price,
    priceType: row.price_type,
    durationMinutes: row.duration_minutes,
    bookingEnabled: Boolean(row.booking_enabled),
    active: Boolean(row.active),
  };

  if (row.maximum_price != null) service.maximumPrice = row.maximum_price;
  if (row.image_url != null) service.imageUrl = row.image_url;

  return service;
}

function serializeAvailability(row) {
  const availability = {
    id: row.id,
    providerId: row.business_id,
    serviceId: row.service_id,
    professionalId: row.professional_id,
    date: row.date,
    time: row.time,
    availableSlots: row.available_slots,
  };

  if (row.end_time != null) availability.endTime = row.end_time;

  return availability;
}

// Two rows (min_version, kill_switch_message) editable via the admin panel.
// Returns null if neither is set — the mobile client treats a missing
// appConfig field as "no constraint," never as "block everything."
async function getAppConfig() {
  const rows = await query("SELECT key_name, value FROM app_config WHERE key_name IN ('min_version', 'kill_switch_message')");
  if (rows.length === 0) return null;

  const byKey = Object.fromEntries(rows.map((row) => [row.key_name, row.value]));
  const config = {};
  if (byKey.min_version) config.minVersion = byKey.min_version;
  if (byKey.kill_switch_message) config.message = byKey.kill_switch_message;

  return Object.keys(config).length > 0 ? config : null;
}

async function buildCatalogSnapshot() {
  const businesses = await query("SELECT * FROM businesses WHERE publication_status = 'published' ORDER BY created_at ASC");

  let services = [];
  let availability = [];
  if (businesses.length > 0) {
    const businessIds = businesses.map((b) => b.id);
    const placeholders = businessIds.map(() => "?").join(",");

    services = await query(`SELECT * FROM services WHERE active = 1 AND business_id IN (${placeholders})`, businessIds);

    availability = await query(
      `SELECT * FROM availability
       WHERE business_id IN (${placeholders})
         AND date >= CURDATE() AND date < DATE_ADD(CURDATE(), INTERVAL 14 DAY)`,
      businessIds,
    );
  }

  const serviceIdsByBusiness = new Map();
  for (const service of services) {
    const list = serviceIdsByBusiness.get(service.business_id) ?? [];
    list.push(service.id);
    serviceIdsByBusiness.set(service.business_id, list);
  }

  const appConfig = await getAppConfig();

  return {
    providers: businesses.map((row) => serializeProvider(row, serviceIdsByBusiness)),
    services: services.map(serializeService),
    availability: availability.map(serializeAvailability),
    managedMerchantIds: [],
    managedServiceIds: [],
    generatedAt: new Date().toISOString(),
    ...(appConfig ? { appConfig } : {}),
  };
}
