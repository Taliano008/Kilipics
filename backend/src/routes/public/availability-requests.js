import { createAvailabilityRequest } from "../../services/availability-requests.js";

export default async function publicAvailabilityRequestRoutes(app) {
  // Consumer-facing "Check availability" form — no auth (a consumer isn't
  // required to be signed in to submit one, mirroring the booking screen
  // itself). Tighter than the global rate limit since this writes real
  // personal data (name, WhatsApp number) from an unauthenticated caller.
  app.post(
    "/availability-requests",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const created = await createAvailabilityRequest(request.body || {});
      reply.code(201);
      return { ok: true, request: created };
    },
  );
}
