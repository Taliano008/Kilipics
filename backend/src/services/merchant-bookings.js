import { execute, query, queryOne } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest, conflict, notFound } from "../lib/http-errors.js";
import { notifyBookingStatusChange, retractBookingNotifications } from "./notifications.js";

const STATUSES = new Set(["pending", "confirmed", "cancelled", "completed"]);

// What a merchant may move a booking to, from where it is now.
//  - confirmed -> confirmed is a change of time.
//  - "-> pending" is the Undo after an accept or a decline.
//  - completed -> confirmed corrects a mis-tap on "Mark completed".
// A cancellation made by the customer is final and isn't in this table at
// all — see the check in updateMerchantBookingStatus.
const MERCHANT_TRANSITIONS = {
  pending: new Set(["confirmed", "cancelled"]),
  confirmed: new Set(["confirmed", "completed", "cancelled", "pending"]),
  completed: new Set(["confirmed"]),
  cancelled: new Set(["pending"]),
};
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function wholeNumber(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function requireBusinessId(businessId) {
  if (!businessId) {
    throw badRequest(
      "business_required",
      "Finish setting up your business profile before adding bookings.",
    );
  }
}

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function serializeMerchantBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    serviceId: row.service_id ?? null,
    serviceName: row.service_name,
    price: row.price,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    date: row.date,
    // TIME(0) comes back as "HH:MM:SS"; the app works in "HH:MM".
    time: String(row.time).slice(0, 5),
    durationMinutes: row.duration_minutes,
    status: row.status,
    notes: row.notes ?? "",
    source: row.source,
    // Set on consumer app bookings only: the time of day they asked for.
    preferredTime: row.preferred_time ?? null,
    // "customer" when the customer cancelled from the app. Such a booking
    // can't be revived, and shows as an alert until cancelAcknowledged.
    cancelledBy: row.status === "cancelled" ? (row.cancelled_by ?? "merchant") : null,
    cancelAcknowledged: row.cancel_acknowledged_at != null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Filters are all optional: `date` for a single day, or `from`/`to` for an
// inclusive range (the dashboard loads everything from yesterday onward).
export async function listMerchantBookings(businessId, filters = {}) {
  requireBusinessId(businessId);
  const where = ["business_id = ?"];
  const values = [businessId];

  for (const key of ["date", "from", "to"]) {
    const value = filters[key];
    if (value === undefined || value === "") continue;
    if (!isValidDate(value)) {
      throw badRequest("invalid_date", `${key} must be a YYYY-MM-DD date.`, [key]);
    }
    where.push(key === "date" ? `"date" = ?` : key === "from" ? `"date" >= ?` : `"date" <= ?`);
    values.push(value);
  }
  if (filters.status !== undefined && filters.status !== "") {
    if (!STATUSES.has(filters.status)) {
      throw badRequest("invalid_status", "Unknown booking status.", ["status"]);
    }
    where.push("status = ?");
    values.push(filters.status);
  }

  const rows = await query(
    `SELECT * FROM bookings WHERE ${where.join(" AND ")} ORDER BY "date" ASC, "time" ASC, created_at ASC`,
    values,
  );
  return rows.map(serializeMerchantBooking);
}

// serviceId is optional (a merchant may log a walk-in before listing any
// services). When given, the service's current name, price and duration
// are snapshotted onto the booking; an explicit durationMinutes still wins.
// A booking the merchant enters themselves starts confirmed — there's no
// one for them to accept it from — so it's on the schedule and in sales
// straight away.
export async function createMerchantBooking(businessId, input) {
  requireBusinessId(businessId);

  const customerName = input?.customerName?.trim();
  if (!customerName) {
    throw badRequest("customer_name_required", "Customer name is required.", ["customerName"]);
  }
  const customerPhone = input?.customerPhone?.trim();
  if (!customerPhone) {
    throw badRequest("customer_phone_required", "Customer phone is required.", ["customerPhone"]);
  }
  if (customerPhone.length > 20) {
    throw badRequest("invalid_phone", "That phone number is too long.", ["customerPhone"]);
  }
  if (!isValidDate(input?.date)) {
    throw badRequest("invalid_date", "Date must be a YYYY-MM-DD date.", ["date"]);
  }
  if (typeof input?.time !== "string" || !TIME_PATTERN.test(input.time)) {
    throw badRequest("invalid_time", "Time must be in 24h HH:MM format, e.g. 14:30.", ["time"]);
  }

  let serviceId = null;
  let serviceName = input?.serviceName?.trim() || "Service";
  let price = wholeNumber(input?.price);
  let durationMinutes = 60;

  if (input?.serviceId) {
    const service = await queryOne("SELECT * FROM services WHERE id = ? AND business_id = ?", [
      input.serviceId,
      businessId,
    ]);
    if (!service) throw notFound("service_not_found", "That service could not be found.");
    serviceId = service.id;
    serviceName = service.name;
    price = service.price;
    durationMinutes = service.duration_minutes || 60;
  }
  if (input?.durationMinutes !== undefined) {
    durationMinutes = Math.min(65535, wholeNumber(input.durationMinutes));
  }

  const id = newId();
  await execute(
    `INSERT INTO bookings (
      id, business_id, service_id, service_name, price, customer_name, customer_phone,
      "date", "time", duration_minutes, status, notes, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, 'manual')`,
    [
      id,
      businessId,
      serviceId,
      serviceName,
      price,
      customerName,
      customerPhone,
      input.date,
      input.time,
      durationMinutes,
      input?.notes?.trim() || null,
    ],
  );

  const created = await queryOne("SELECT * FROM bookings WHERE id = ?", [id]);
  return serializeMerchantBooking(created);
}

// Status is the one field a merchant changes after creation. Two extras
// ride along with it:
//  - time: accepting a request sets the real appointment time (a consumer
//    only gives a time of day), so it's only applied with "confirmed";
//  - declineReason: passed on to the customer when declining, not stored.
// Everything downstream follows from this one write — the customer's
// notification and Activity entry here, the schedule and sales figures on
// the merchant's own screens when they next read the booking.
export async function updateMerchantBookingStatus(businessId, bookingId, status, options = {}) {
  requireBusinessId(businessId);
  if (!STATUSES.has(status)) {
    throw badRequest("invalid_status", "Unknown booking status.", ["status"]);
  }
  const { time, declineReason } = options;
  const setTime = status === "confirmed" && time !== undefined && time !== null && time !== "";
  if (setTime && (typeof time !== "string" || !TIME_PATTERN.test(time))) {
    throw badRequest("invalid_time", "Time must be in 24h HH:MM format, e.g. 14:30.", ["time"]);
  }

  const existing = await queryOne("SELECT * FROM bookings WHERE id = ? AND business_id = ?", [
    bookingId,
    businessId,
  ]);
  if (!existing) {
    throw notFound("booking_not_found", "That booking could not be found.");
  }

  if (existing.status === "cancelled" && existing.cancelled_by === "customer") {
    throw conflict(
      "cancelled_by_customer",
      "The customer cancelled this booking, so it can't be changed. They can book again from the app.",
    );
  }
  // Asking for the state it's already in changes nothing (a double tap, or
  // a retry after a dropped response) — except confirmed with a new time.
  if (existing.status === status && !setTime) {
    return serializeMerchantBooking(existing);
  }
  if (!MERCHANT_TRANSITIONS[existing.status]?.has(status)) {
    throw conflict(
      "invalid_transition",
      `A ${existing.status} booking can't be changed to ${status}.`,
    );
  }

  // cancelled_by records that this cancellation is the merchant's own (so
  // they can undo it); it's cleared again on any move out of cancelled.
  await execute(
    `UPDATE bookings
     SET status = ?, "time" = COALESCE(?, "time"), cancelled_by = ?, cancel_acknowledged_at = NULL
     WHERE id = ? AND business_id = ?`,
    [status, setTime ? time : null, status === "cancelled" ? "merchant" : null, bookingId, businessId],
  );
  const updated = await queryOne("SELECT * FROM bookings WHERE id = ?", [bookingId]);

  // Keep the customer who booked from the app in step — but never at the
  // cost of the status update itself.
  try {
    const timeChanged = String(existing.time).slice(0, 5) !== String(updated.time).slice(0, 5);
    if (status === "pending" && existing.status !== "pending") {
      // The merchant undid an accept/decline: take back what we told them.
      await retractBookingNotifications(bookingId);
    } else if (existing.status !== status) {
      await notifyBookingStatusChange(updated, status, {
        declineReason: typeof declineReason === "string" ? declineReason.trim().slice(0, 120) : "",
      });
    } else if (status === "confirmed" && timeChanged) {
      await notifyBookingStatusChange(updated, "rescheduled");
    }
  } catch (err) {
    console.error("booking notification failed", err);
  }
  return serializeMerchantBooking(updated);
}

// Dismisses the "Cancelled by customer" alert for one booking.
export async function acknowledgeBookingCancellation(businessId, bookingId) {
  requireBusinessId(businessId);
  const result = await execute(
    `UPDATE bookings SET cancel_acknowledged_at = (now() AT TIME ZONE 'utc')
     WHERE id = ? AND business_id = ? AND status = 'cancelled'`,
    [bookingId, businessId],
  );
  if (result.affectedRows === 0) {
    throw notFound("booking_not_found", "That booking could not be found.");
  }
  return serializeMerchantBooking(await queryOne("SELECT * FROM bookings WHERE id = ?", [bookingId]));
}
