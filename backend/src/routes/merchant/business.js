import { flexibleMerchantAuth } from "../../middleware/flexible-merchant-auth.js";
import {
  findBusinessByMerchantId,
  saveStep1,
  saveStep2,
  saveStep3,
  submitOnboarding,
  updateBusiness,
} from "../../services/merchant-business.js";

export default async function merchantBusinessRoutes(app) {
  app.addHook("preHandler", flexibleMerchantAuth);

  // Get current merchant business profile & onboarding status
  app.get("/", async (request) => {
    const business = await findBusinessByMerchantId(request.merchant.merchantId);
    return {
      business,
      merchantToken: request.merchant.newMerchantToken || null,
    };
  });

  // Step 1: Save basic business details
  app.post("/step1", async (request) => {
    const business = await saveStep1(request.merchant.merchantId, request.body || {});
    return {
      ok: true,
      business,
      merchantToken: request.merchant.newMerchantToken || null,
    };
  });

  // Step 2: Save location & service area
  app.post("/step2", async (request) => {
    const business = await saveStep2(request.merchant.merchantId, request.body || {});
    return {
      ok: true,
      business,
      merchantToken: request.merchant.newMerchantToken || null,
    };
  });

  // Step 3: Save photos and schedule hours
  app.post("/step3", async (request) => {
    const business = await saveStep3(request.merchant.merchantId, request.body || {});
    return {
      ok: true,
      business,
      merchantToken: request.merchant.newMerchantToken || null,
    };
  });

  // Finalize onboarding submission
  app.post("/submit", async (request) => {
    const business = await submitOnboarding(request.merchant.merchantId);
    return {
      ok: true,
      business,
      status: "pending_review",
      submittedAt: business.submittedAt,
      merchantToken: request.merchant.newMerchantToken || null,
    };
  });

  // Update business profile fields (used by Merchant Profile tab)
  app.patch("/", async (request) => {
    const business = await updateBusiness(request.merchant.merchantId, request.body || {});
    return {
      ok: true,
      business,
      merchantToken: request.merchant.newMerchantToken || null,
    };
  });
}
