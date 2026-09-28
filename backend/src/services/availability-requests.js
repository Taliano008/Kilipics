import { execute, query, queryOne } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest, notFound } from "../lib/http-errors.js";

const PREFERRED_TIMES = new Set(["morning", "afternoon", "evening", "flexible"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Unauthenticated endpoint with no route schema — a non-string field must
// come back as a 400 from the checks below, not a TypeError 500 from .trim().
function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

function serializeAvailabilityRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    serviceId: row.service_id,
    serviceName: row.service_name ?? null,
    consumerName: row.consumer_name,
    whatsappNumber: row.whatsapp_number,
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    notes: row.notes || "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Public endpoint, no auth — mirrors the gating already enforced client-side
// (app/booking/[providerId].tsx's own access gate) so a direct API call
// can't create a request against a business that was never actually
// bookable in the first place.
export async function createAvailabilityRequest(input) {
  const businessId = str(input?.businessId);
  if (!businessId) throw badRequest("business_id_required", "businessId is required.", ["businessId"]);

  const business = await queryOne("SELECT * FROM businesses WHERE id = ?", [businessId]);
  if (!business) throw notFound("business_not_found", "That business could not be found.");
  if (business.limited_listing || !business.booking_enabled) {
    throw badRequest(
      "booking_not_available",
      "This business is not currently accepting availability requests.",
    );
  }

  let serviceId = str(input?.serviceId) || null;
  if (serviceId) {
    const service = await queryOne(
      "SELECT * FROM services WHERE id = ? AND business_id = ?",
      [serviceId, businessId],
    );
    if (!service || !service.active || !service.booking_enabled) {
      throw badRequest(
        "service_not_bookable",
        "That service is not currently accepting availability requests.",
      );
    }
  }

  const consumerName = str(input?.consumerName);
  if (!consumerName) throw badRequest("consumer_name_required", "Your name is required.", ["consumerName"]);

  const whatsappNumber = str(input?.whatsappNumber);
  if (!whatsappNumber) {
    throw badRequest("whatsapp_number_required", "A WhatsApp number is required.", ["whatsappNumber"]);
  }

  const preferredDate = str(input?.preferredDate);
  if (!preferredDate || !DATE_RE.test(preferredDate)) {
    throw badRequest("preferred_date_required", "A valid preferred date is required.", ["preferredDate"]);
  }

  const preferredTime = PREFERRED_TIMES.has(input?.preferredTime) ? input.preferredTime : "flexible";
  const notes = str(input?.notes) || null;

  const id = newId();
  await execute(
    `INSERT INTO availability_requests (
      id, business_id, service_id, consumer_name, whatsapp_number,
      preferred_date, preferred_time, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, businessId, serviceId, consumerName, whatsappNumber, preferredDate, preferredTime, notes],
  );

  const created = await queryOne("SELECT * FROM availability_requests WHERE id = ?", [id]);
  return serializeAvailabilityRequest(created);
}

const REQUEST_STATUSES = new Set(["new", "contacted", "closed"]);

function requireBusinessId(businessId) {
  if (!businessId) {
    throw badRequest("business_required", "Finish setting up your business profile to receive requests.");
  }
}

// Merchant-side read of what consumers submitted above. Newest first, with
// the service name joined in so the Bookings tab doesn't need a second
// round trip. Scoped by the caller's verified businessId only.
export async function listAvailabilityRequestsForBusiness(businessId) {
  requireBusinessId(businessId);
  const rows = await query(
    `SELECT r.*, s.name AS service_name
     FROM availability_requests r
     LEFT JOIN services s ON s.id = r.service_id
     WHERE r.business_id = ?
     ORDER BY r.created_at DESC
     LIMIT 200`,
    [businessId],
  );
  return rows.map(serializeAvailabilityRequest);
}

export async function updateAvailabilityRequestStatus(businessId, requestId, status) {
  requireBusinessId(businessId);
  if (!REQUEST_STATUSES.has(status)) {
    throw badRequest("invalid_status", "Status must be new, contacted, or closed.", ["status"]);
  }
  // business_id in the WHERE is the ownership check — another merchant's
  // request id simply matches nothing and 404s.
  const owned = await queryOne("SELECT id FROM availability_requests WHERE id = ? AND business_id = ?", [
    requestId,
    businessId,
  ]);
  if (!owned) throw notFound("request_not_found", "That request could not be found.");
  await execute("UPDATE availability_requests SET status = ? WHERE id = ? AND business_id = ?", [
    status,
    requestId,
    businessId,
  ]);

  const row = await queryOne(
    `SELECT r.*, s.name AS service_name
     FROM availability_requests r
     LEFT JOIN services s ON s.id = r.service_id
     WHERE r.id = ?`,
    [requestId],
  );
  return serializeAvailabilityRequest(row);
}
