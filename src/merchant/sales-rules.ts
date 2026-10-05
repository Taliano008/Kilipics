import { localIsoDate } from "@/utils/dates";

type BookingLike = { status: string; date: string; time: string };

// When a booking is revenue on the Sales tab:
// - completed: always — the merchant has confirmed it happened.
// - confirmed: once its appointment time has passed. Before that it's
//   expected income, not earned; a confirmed booking for next Friday must not
//   already inflate this week's total.
// - pending / cancelled: never.
export function bookingCountsAsSale(booking: BookingLike, now: Date = new Date()) {
  if (booking.status === "completed") return true;
  if (booking.status !== "confirmed") return false;
  const today = localIsoDate(now);
  if (booking.date !== today) return booking.date < today;
  const [h, m] = booking.time.split(":").map(Number);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return (h || 0) * 60 + (m || 0) <= minutesNow;
}

// Confirmed but not yet due — shown as "upcoming", not counted.
export function bookingIsUpcoming(booking: BookingLike, now: Date = new Date()) {
  return booking.status === "confirmed" && !bookingCountsAsSale(booking, now);
}

// Days a merchant can back-date a hand-entered transaction to; matches the
// backend's MAX_BACKDATE_DAYS in services/merchant-sales.js.
export const MAX_BACKDATE_DAYS = 90;
