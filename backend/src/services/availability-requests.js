import { execute, queryOne } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest, notFound } from "../lib/http-errors.js";
import { findLiveBusiness } from "./business-visibility.js";

const PREFERRED_TIMES = new Set(["morning", "afternoon", "evening", "flexible"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SERVICES_PER_REQUEST = 10;

function serializeAvailabilityRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    serviceId: row.service_id,
    serviceIds: Array.isArray(row.service_ids) ? row.service_ids : [],
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
  const businessId = input?.businessId?.trim();
  if (!businessId) throw badRequest("business_id_required", "businessId is required.", ["businessId"]);

  const business = await findLiveBusiness(businessId);
  if (!business) throw notFound("business_not_found", "That business could not be found.");
  if (business.limited_listing || !business.booking_enabled) {
    throw badRequest(
      "booking_not_available",
      "This business is not currently accepting availability requests.",
    );
  }

  // serviceIds (several services in one request) is the current client's
  // shape; a lone serviceId is still accepted from older app builds.
  const requestedIds = Array.isArray(input?.serviceIds)
    ? input.serviceIds
    : [input?.serviceId];
  const serviceIds = [
    ...new Set(
      requestedIds
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  ];
  if (serviceIds.length > MAX_SERVICES_PER_REQUEST) {
    throw badRequest(
      "too_many_services",
      `Pick at most ${MAX_SERVICES_PER_REQUEST} services per request.`,
      ["serviceIds"],
    );
  }
  for (const id of serviceIds) {
    const service = await queryOne(
      "SELECT * FROM services WHERE id = ? AND business_id = ?",
      [id, businessId],
    );
    if (!service || !service.active || !service.booking_enabled) {
      throw badRequest(
        "service_not_bookable",
        "That service is not currently accepting availability requests.",
      );
    }
  }
  const serviceId = serviceIds[0] ?? null;

  const consumerName = input?.consumerName?.trim();
  if (!consumerName) throw badRequest("consumer_name_required", "Your name is required.", ["consumerName"]);

  const whatsappNumber = input?.whatsappNumber?.trim();
  if (!whatsappNumber) {
    throw badRequest("whatsapp_number_required", "A WhatsApp number is required.", ["whatsappNumber"]);
  }

  const preferredDate = input?.preferredDate?.trim();
  if (!preferredDate || !DATE_RE.test(preferredDate)) {
    throw badRequest("preferred_date_required", "A valid preferred date is required.", ["preferredDate"]);
  }

  const preferredTime = PREFERRED_TIMES.has(input?.preferredTime) ? input.preferredTime : "flexible";
  const notes = input?.notes?.trim() || null;

  const id = newId();
  await execute(
    `INSERT INTO availability_requests (
      id, business_id, service_id, service_ids, consumer_name, whatsapp_number,
      preferred_date, preferred_time, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      businessId,
      serviceId,
      JSON.stringify(serviceIds),
      consumerName,
      whatsappNumber,
      preferredDate,
      preferredTime,
      notes,
    ],
  );

  const created = await queryOne("SELECT * FROM availability_requests WHERE id = ?", [id]);
  return serializeAvailabilityRequest(created);
}
