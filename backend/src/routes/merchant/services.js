import { flexibleMerchantAuth } from "../../middleware/flexible-merchant-auth.js";
import {
  listMerchantServices,
  createMerchantService,
  updateMerchantService,
  setMerchantServiceActive,
  deleteMerchantService,
  duplicateMerchantService,
  reorderMerchantServices,
} from "../../services/merchant-services.js";

export default async function merchantServicesRoutes(app) {
  app.addHook("preHandler", flexibleMerchantAuth);

  // List this merchant's service catalog, in display order.
  app.get("/", async (request) => {
    const services = await listMerchantServices(request.merchant.businessId);
    return { services, merchantToken: request.merchant.newMerchantToken || null };
  });

  // Add a service — used by the Services tab's "Add Service" form.
  app.post("/", async (request) => {
    const service = await createMerchantService(request.merchant.businessId, request.body || {});
    return { ok: true, service, merchantToken: request.merchant.newMerchantToken || null };
  });

  // Persist a manual drag/kebab reorder in one call. Placed before the
  // "/:id" routes below only for readability — Fastify matches static
  // segments before params either way.
  app.post("/reorder", async (request) => {
    const services = await reorderMerchantServices(
      request.merchant.businessId,
      request.body?.orderedIds || [],
    );
    return { ok: true, services, merchantToken: request.merchant.newMerchantToken || null };
  });

  app.patch("/:id", async (request) => {
    const service = await updateMerchantService(
      request.merchant.businessId,
      request.params.id,
      request.body || {},
    );
    return { ok: true, service, merchantToken: request.merchant.newMerchantToken || null };
  });

  // Archive: hides the service from the shop page but keeps it (and its
  // history) intact. This is the default "Remove" action from the form.
  app.post("/:id/archive", async (request) => {
    const service = await setMerchantServiceActive(
      request.merchant.businessId,
      request.params.id,
      false,
    );
    return { ok: true, service, merchantToken: request.merchant.newMerchantToken || null };
  });

  app.post("/:id/duplicate", async (request) => {
    const service = await duplicateMerchantService(request.merchant.businessId, request.params.id);
    return { ok: true, service, merchantToken: request.merchant.newMerchantToken || null };
  });

  // Hard delete — only ever offered for a service that's already archived.
  app.delete("/:id", async (request) => {
    await deleteMerchantService(request.merchant.businessId, request.params.id);
    return { ok: true, merchantToken: request.merchant.newMerchantToken || null };
  });
}
