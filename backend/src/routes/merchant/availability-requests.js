import { flexibleMerchantAuth } from "../../middleware/flexible-merchant-auth.js";
import {
  listAvailabilityRequestsForBusiness,
  updateAvailabilityRequestStatus,
} from "../../services/availability-requests.js";

export default async function merchantAvailabilityRequestRoutes(app) {
  app.addHook("preHandler", flexibleMerchantAuth);

  // Consumer "Check availability" requests for this merchant's business —
  // what the seller dashboard's Bookings tab shows as incoming requests.
  app.get("/", async (request) => {
    const requests = await listAvailabilityRequestsForBusiness(request.merchant.businessId);
    return { requests, merchantToken: request.merchant.newMerchantToken || null };
  });

  app.patch(
    "/:id",
    {
      schema: {
        body: {
          type: "object",
          required: ["status"],
          additionalProperties: false,
          properties: { status: { type: "string", enum: ["new", "contacted", "closed"] } },
        },
      },
    },
    async (request) => {
      const updated = await updateAvailabilityRequestStatus(
        request.merchant.businessId,
        request.params.id,
        request.body.status,
      );
      return { ok: true, request: updated, merchantToken: request.merchant.newMerchantToken || null };
    },
  );
}
