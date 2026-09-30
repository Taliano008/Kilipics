import { execute, query, queryOne } from "../db/connection.js";
import { newId } from "../lib/ids.js";

const MAX_LISTED = 50;

function serializeNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    bookingId: row.booking_id ?? null,
    businessId: row.business_id ?? null,
    read: row.read_at !== null,
    createdAt: row.created_at,
  };
}

function formatDate(value) {
  // DATE columns may come back as a Date or a "YYYY-MM-DD" string.
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// "17:30:00" -> "5:30 PM"
function formatTime(value) {
  const [h, m] = String(value).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${period}`;
}

// When a merchant undoes an accept or decline, the booking goes back to
// pending and what the customer was told no longer holds.
export async function retractBookingNotifications(bookingId) {
  await execute(
    "DELETE FROM notifications WHERE booking_id = ? AND type IN ('booking_confirmed', 'booking_declined', 'booking_rescheduled')",
    [bookingId],
  );
}

// Tells the consumer who made a booking that the merchant has acted on it.
// A no-op for bookings with no linked account (a merchant's manual entry,
// or one made signed-out) and for statuses the consumer set themselves.
export async function notifyBookingStatusChange(booking, status, { declineReason = "" } = {}) {
  if (!booking?.user_id) return;

  const business = await queryOne("SELECT name FROM businesses WHERE id = ?", [booking.business_id]);
  const businessName = business?.name || "The business";
  const when = `${formatDate(booking.date)} at ${formatTime(booking.time)}`;

  let type;
  let title;
  let body;
  if (status === "confirmed") {
    type = "booking_confirmed";
    title = "Booking confirmed";
    body = `${businessName} accepted your ${booking.service_name} booking. You're booked for ${when}.`;
  } else if (status === "rescheduled") {
    type = "booking_rescheduled";
    title = "Booking time changed";
    body = `${businessName} moved your ${booking.service_name} booking. It's now ${when}.`;
  } else if (status === "cancelled") {
    type = "booking_declined";
    title = "Booking not available";
    body = `${businessName} couldn't take your ${booking.service_name} booking for ${formatDate(booking.date)}${
      declineReason ? ` (${declineReason.toLowerCase()})` : ""
    }. Nothing was charged — you can pick another date or business.`;
  } else if (status === "completed") {
    type = "booking_completed";
    title = "Appointment completed";
    body = `Your ${booking.service_name} appointment at ${businessName} is marked complete. Leave a review to help others.`;
  } else {
    return;
  }

  await execute(
    `INSERT INTO notifications (id, user_id, type, title, body, booking_id, business_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), booking.user_id, type, title, body, booking.id, booking.business_id],
  );
}

export async function listNotifications(userId) {
  const rows = await query(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ${MAX_LISTED}`,
    [userId],
  );
  const unread = await queryOne(
    "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL",
    [userId],
  );
  return {
    notifications: rows.map(serializeNotification),
    unreadCount: Number(unread?.count ?? 0),
  };
}

export async function markAllNotificationsRead(userId) {
  await execute(
    "UPDATE notifications SET read_at = (now() AT TIME ZONE 'utc') WHERE user_id = ? AND read_at IS NULL",
    [userId],
  );
}

// Tells a merchant what happened to their listing review. A merchant has no
// notification inbox of their own — it goes to the customer account that
// owns the business (merchants.owner_user_id), which is the same person and
// the same app. A no-op for a merchant with no linked customer account.
export async function notifyBusinessReview(business, outcome, note = "") {
  const merchant = await queryOne("SELECT owner_user_id FROM merchants WHERE id = ?", [
    business.merchant_id,
  ]);
  if (!merchant?.owner_user_id) return;

  const name = business.name || "Your business";
  const message =
    outcome === "approved"
      ? {
          type: "business_approved",
          title: "Your business is live",
          body: `${name} has been approved. Customers can now find it and book your services.`,
        }
      : {
          type: "business_changes_requested",
          title: "Changes needed before you go live",
          body: `${name} isn't live yet. ${note}`.trim(),
        };

  await execute(
    `INSERT INTO notifications (id, user_id, type, title, body, business_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newId(), merchant.owner_user_id, message.type, message.title, message.body, business.id],
  );
}
