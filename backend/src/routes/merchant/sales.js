import { flexibleMerchantAuth } from "../../middleware/flexible-merchant-auth.js";
import {
  createSalesTransaction,
  deleteSalesTransaction,
  getMerchantSales,
  importLocalSales,
  saveSalesGoals,
} from "../../services/merchant-sales.js";

export default async function merchantSalesRoutes(app) {
  app.addHook("preHandler", flexibleMerchantAuth);

  const withToken = (request, body) => ({
    ...body,
    merchantToken: request.merchant.newMerchantToken || null,
  });

  // Hand-entered transactions plus the income targets. Booking-derived
  // sales come from /api/merchant/bookings, not from here.
  app.get("/", async (request) =>
    withToken(request, await getMerchantSales(request.merchant.businessId)),
  );

  app.post("/transactions", async (request, reply) => {
    const transaction = await createSalesTransaction(
      request.merchant.businessId,
      request.body || {},
    );
    reply.code(201);
    return withToken(request, { ok: true, transaction });
  });

  app.delete("/transactions/:id", async (request) => {
    await deleteSalesTransaction(request.merchant.businessId, request.params.id);
    return withToken(request, { ok: true });
  });

  app.put("/goals", async (request) => {
    const goals = await saveSalesGoals(request.merchant.businessId, request.body || {});
    return withToken(request, { ok: true, goals });
  });

  // One-time upload of a phone's old local-only sales store.
  app.post("/import", async (request) =>
    withToken(request, {
      ok: true,
      ...(await importLocalSales(request.merchant.businessId, request.body || {})),
    }),
  );
}
