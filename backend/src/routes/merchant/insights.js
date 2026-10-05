import { flexibleMerchantAuth } from "../../middleware/flexible-merchant-auth.js";
import { getStoreVisits } from "../../services/merchant-insights.js";

export default async function merchantInsightsRoutes(app) {
  app.addHook("preHandler", flexibleMerchantAuth);

  // Store visits card on the Profile tab.
  // ?range=today|week|month&tzOffset=<minutes east of UTC>&exclude=<device id>
  app.get("/visits", async (request) => ({
    ...(await getStoreVisits(request.merchant.businessId, request.query || {})),
    merchantToken: request.merchant.newMerchantToken || null,
  }));
}
