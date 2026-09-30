import { execute, query, queryOne } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest, notFound } from "../lib/http-errors.js";
import { businessToday } from "../lib/dates.js";
import { findLiveBusiness } from "./business-visibility.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SERVICES_PER_REQUEST = 10;

// A consumer picks a time of day, not a slot. The bookings table needs a
// concrete time, so each preference maps to a representative start; the
// preference itself is stored alongside (preferred_time) so the merchant
// dashboard can show it as "to be confirmed" rather than a fixed slot.
const PREFERRED_TIME_START = {
  morning: "09:00",
  afternoon: "13:00",
  evening: "17:00",
  flexible: "10:00",
};

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function serializeConsumerBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name ?? "",
    serviceId: row.service_id ?? null,
    serviceName: row.service_name,
    price: row.price,
    date: row.date,
    time: String(row.time).slice(0, 5),
    preferredTime: row.preferred_time ?? null,
    durationMinutes: row.duration_minutes,
    status: row.status,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_WITH_BUSINESS = `
  SELECT b.*, biz.name AS business_name
  FROM bookings b
  JOIN businesses biz ON biz.id = b.business_id`;

// One booking row per selected service, all pending until the merchant
// accepts, each linked to the signed-in consumer who made it.
// Same gating as the booking screen's own access gate, so a direct API call
// can't book a business or service that was never bookable.
export async function createConsumerBookings(userId, input) {
  const businessId = typeof input?.businessId === "string" ? input.businessId.trim() : "";
  if (!businessId) throw badRequest("business_id_required", "businessId is required.", ["businessId"]);

  // Live = published and not suspended. An unpublished or suspended
  // business is reported as not found, the same as one that never existed —
  // an old link or a direct API call can't book what search no longer shows.
  const business = await findLiveBusiness(businessId);
  if (!business) throw notFound("business_not_found", "That business could not be found.");
  if (business.limited_listing || !business.booking_enabled) {
    throw badRequest("booking_not_available", "This business is not currently accepting bookings.");
  }

  const serviceIds = [
    ...new Set(
      (Array.isArray(input?.serviceIds) ? input.serviceIds : [])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  ];
  if (serviceIds.length === 0) {
    throw badRequest("service_required", "Pick at least one service to book.", ["serviceIds"]);
  }
  if (serviceIds.length > MAX_SERVICES_PER_REQUEST) {
    throw badRequest(
      "too_many_services",
      `Pick at most ${MAX_SERVICES_PER_REQUEST} services per booking.`,
      ["serviceIds"],
    );
  }

  const services = [];
  for (const id of serviceIds) {
    const service = await queryOne("SELECT * FROM services WHERE id = ? AND business_id = ?", [
      id,
      businessId,
    ]);
    if (!service || !service.active || !service.booking_enabled) {
      throw badRequest("service_not_bookable", "That service is not currently accepting bookings.");
    }
    services.push(service);
  }

  const customerName = typeof input?.customerName === "string" ? input.customerName.trim() : "";
  if (!customerName) {
    throw badRequest("customer_name_required", "Your name is required.", ["customerName"]);
  }
  const customerPhone = typeof input?.customerPhone === "string" ? input.customerPhone.trim() : "";
  if (!customerPhone) {
    throw badRequest("customer_phone_required", "A WhatsApp number is required.", ["customerPhone"]);
  }
  if (customerPhone.length > 20) {
    throw badRequest("invalid_phone", "That phone number is too long.", ["customerPhone"]);
  }
  if (!isValidDate(input?.date)) {
    throw badRequest("invalid_date", "A valid date is required.", ["date"]);
  }
  // The app's calendar already greys out past days; this is the same rule
  // for anything that reaches the API another way.
  if (input.date < businessToday()) {
    throw badRequest("date_in_past", "Pick today or a later date.", ["date"]);
  }

  const preferredTime = Object.hasOwn(PREFERRED_TIME_START, input?.preferredTime)
    ? input.preferredTime
    : "flexible";
  const time = PREFERRED_TIME_START[preferredTime];
  const notes = typeof input?.notes === "string" && input.notes.trim() ? input.notes.trim() : null;

  const ids = [];
  for (const service of services) {
    const id = newId();
    await execute(
      `INSERT INTO bookings (
        id, business_id, service_id, service_name, price, customer_name, customer_phone,
        "date", "time", duration_minutes, status, notes, source, user_id, preferred_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'app', ?, ?)`,
      [
        id,
        businessId,
        service.id,
        service.name,
        service.price,
        customerName,
        customerPhone,
        input.date,
        time,
        service.duration_minutes || 60,
        notes,
        userId,
        preferredTime,
      ],
    );
    ids.push(id);
  }

  const created = [];
  for (const id of ids) {
    created.push(
      serializeConsumerBooking(await queryOne(`${SELECT_WITH_BUSINESS} WHERE b.id = ?`, [id])),
    );
  }
  return created;
}

export async function listConsumerBookings(userId) {
  const rows = await query(
    `${SELECT_WITH_BUSINESS} WHERE b.user_id = ? ORDER BY b."date" DESC, b."time" DESC, b.created_at DESC`,
    [userId],
  );
  return rows.map(serializeConsumerBooking);
}

// A consumer can only cancel their own booking, and only while it's still
// ahead of them (pending or confirmed) — a completed or already-cancelled
// booking is history.
export async function cancelConsumerBooking(userId, bookingId) {
  const booking = await queryOne("SELECT * FROM bookings WHERE id = ? AND user_id = ?", [
    bookingId,
    userId,
  ]);
  if (!booking) throw notFound("booking_not_found", "That booking could not be found.");
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    throw badRequest("booking_not_cancellable", "This booking can no longer be cancelled.");
  }

  // cancelled_by marks this as final for the merchant (they can't revive
  // it) and, with cancel_acknowledged_at cleared, raises the "Cancelled by
  // customer" alert on their Bookings tab.
  await execute(
    `UPDATE bookings SET status = 'cancelled', cancelled_by = 'customer', cancel_acknowledged_at = NULL
     WHERE id = ? AND user_id = ?`,
    [bookingId, userId],
  );
  return serializeConsumerBooking(
    await queryOne(`${SELECT_WITH_BUSINESS} WHERE b.id = ?`, [bookingId]),
  );
}
