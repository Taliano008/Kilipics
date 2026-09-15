import { flexibleMerchantAuth } from "../../middleware/flexible-merchant-auth.js";
import { badRequest } from "../../lib/http-errors.js";
import { saveMerchantPhotoUpload } from "../../services/merchant-media.js";

export default async function merchantMediaRoutes(app) {
  app.addHook("preHandler", flexibleMerchantAuth);

  // Accepts one multipart file field named "photo", optionally alongside a
  // "purpose" field (cover|gallery|look|service, defaults to gallery — see
  // media_uploads.purpose). Used by both onboarding step 3's photo grid and
  // the Merchant Profile tab's "Add Studio Photo" flow, either from the
  // device's photo library or straight from the camera — expo-image-picker
  // hands both back as the same kind of file on the client, so one endpoint
  // covers both.
  app.post("/photos", async (request) => {
    const file = await request.file();
    if (!file) throw badRequest("no_file", "No photo was uploaded.");

    const purposeField = file.fields?.purpose;
    const purpose = typeof purposeField?.value === "string" ? purposeField.value : undefined;

    const uploaded = await saveMerchantPhotoUpload({
      merchantId: request.merchant.merchantId,
      businessId: request.merchant.businessId,
      purpose,
      file,
    });

    return {
      ok: true,
      url: uploaded.url,
      merchantToken: request.merchant.newMerchantToken || null,
    };
  });
}
