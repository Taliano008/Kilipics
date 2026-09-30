import { consumerAuth } from "../../middleware/consumer-auth.js";
import {
  cancelConsumerBooking,
  createConsumerBookings,
  listConsumerBookings,
} from "../../services/consumer-bookings.js";

export default async function consumerBookingRoutes(app) {
  // Every booking belongs to a signed-in consumer: it's what lets them track
  // and cancel it, lets the merchant's reply reach them as a notification,
  // and stops anonymous callers flooding a business with fake requests.
  app.addHook("preHandler", consumerAuth);

  // Book one or more services at a business. Tighter than the global rate
  // limit since each call puts work in front of a merchant.
  app.post(
    "/",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const bookings = await createConsumerBookings(request.consumer.userId, request.body || {});
      reply.code(201);
      return { ok: true, bookings };
    },
  );

  // The signed-in consumer's own bookings, newest date first.
  app.get("/", async (request) => {
    const bookings = await listConsumerBookings(request.consumer.userId);
    return { bookings };
  });

  app.post("/:id/cancel", async (request) => {
    const booking = await cancelConsumerBooking(request.consumer.userId, request.params.id);
    return { ok: true, booking };
  });
}
