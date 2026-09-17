import { execute, queryOne } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest, notFound } from "../lib/http-errors.js";

const PREFERRED_TIMES = new Set(["morning", "afternoon", "evening", "flexible"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function serializeAvailabilityRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    serviceId: row.service_id,
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

  const business = await queryOne("SELECT * FROM businesses WHERE id = ?", [businessId]);
  if (!business) throw notFound("business_not_found", "That business could not be found.");
  if (business.limited_listing || !business.booking_enabled) {
    throw badRequest(
      "booking_not_available",
      "This business is not currently accepting availability requests.",
    );
  }

  let serviceId = input?.serviceId?.trim() || null;
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
      id, business_id, service_id, consumer_name, whatsapp_number,
      preferred_date, preferred_time, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, businessId, serviceId, consumerName, whatsappNumber, preferredDate, preferredTime, notes],
  );

  const created = await queryOne("SELECT * FROM availability_requests WHERE id = ?", [id]);
  return serializeAvailabilityRequest(created);
}
