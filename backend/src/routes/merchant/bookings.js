import { flexibleMerchantAuth } from "../../middleware/flexible-merchant-auth.js";
import { pickAllowed } from "../../lib/validation.js";
import { unprocessable } from "../../lib/http-errors.js";
import {
  listMerchantBookings,
  createMerchantBooking,
  updateMerchantBookingStatus,
  acknowledgeBookingCancellation,
} from "../../services/merchant-bookings.js";

export default async function merchantBookingsRoutes(app) {
  app.addHook("preHandler", flexibleMerchantAuth);

  // ?date=YYYY-MM-DD, or ?from=&to= for a range, plus optional ?status=.
  app.get("/", async (request) => {
    const { date, from, to, status } = request.query || {};
    const bookings = await listMerchantBookings(request.merchant.businessId, {
      date,
      from,
      to,
      status,
    });
    return { bookings, merchantToken: request.merchant.newMerchantToken || null };
  });

  // Manual booking from the dashboard's "New Booking" sheet.
  app.post("/", async (request, reply) => {
    const booking = await createMerchantBooking(request.merchant.businessId, request.body || {});
    reply.code(201);
    return { ok: true, booking, merchantToken: request.merchant.newMerchantToken || null };
  });

  // Accept / decline / complete. `time` sets the appointment time when
  // accepting; `declineReason` is passed on to the customer when declining.
  app.patch("/:id", async (request) => {
    const { updates, rejected } = pickAllowed(request.body, ["status", "time", "declineReason"]);
    if (rejected.length > 0) {
      throw unprocessable(
        "forbidden_field",
        "Only a booking's status and time can be changed.",
        rejected,
      );
    }
    const booking = await updateMerchantBookingStatus(
      request.merchant.businessId,
      request.params.id,
      updates.status,
      { time: updates.time, declineReason: updates.declineReason },
    );
    return { ok: true, booking, merchantToken: request.merchant.newMerchantToken || null };
  });

  // Dismiss the "Cancelled by customer" alert for a booking.
  app.post("/:id/acknowledge-cancellation", async (request) => {
    const booking = await acknowledgeBookingCancellation(
      request.merchant.businessId,
      request.params.id,
    );
    return { ok: true, booking, merchantToken: request.merchant.newMerchantToken || null };
  });
}
