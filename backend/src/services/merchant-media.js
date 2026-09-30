import { execute } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest } from "../lib/http-errors.js";
import { storeUpload } from "../lib/storage.js";

// Keep this in sync with what expo-image-picker actually hands back on both
// platforms (JPEG almost always, PNG for screenshots, HEIC only if a client
// deliberately re-encodes — expo-image-picker itself already normalizes
// HEIC to JPEG, but a future direct-camera or web upload path might not).
const ALLOWED_MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

const ALLOWED_PURPOSES = new Set(["cover", "gallery", "look", "service", "logo"]);

// Stores one already-received multipart file part under
// merchants/<merchantId>/ (Supabase Storage or local disk — see
// lib/storage.js) and records it in media_uploads.
// Auth (which merchant this is) is entirely the caller's job — this never
// trusts a merchantId from the request body, only what flexibleMerchantAuth
// already verified.
export async function saveMerchantPhotoUpload({ merchantId, businessId, purpose, file }) {
  if (!file) throw badRequest("no_file", "No photo was uploaded.");

  const ext = ALLOWED_MIME_TO_EXT[file.mimetype];
  if (!ext) {
    throw badRequest("unsupported_type", "Please upload a JPEG, PNG, WEBP, or HEIC photo.");
  }
  const resolvedPurpose = ALLOWED_PURPOSES.has(purpose) ? purpose : "gallery";

  const id = newId();
  // Always forward slashes in the stored path/URL, regardless of the OS
  // this happens to run on — file_path/public_url are shared across
  // whatever serves them later.
  const relativePath = `merchants/${merchantId}/${id}.${ext}`;
  const { url: publicUrl, sizeBytes } = await storeUpload({ relativePath, file });

  await execute(
    `INSERT INTO media_uploads (id, merchant_id, business_id, file_path, public_url, content_type, size_bytes, purpose)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, merchantId, businessId ?? null, relativePath, publicUrl, file.mimetype, sizeBytes, resolvedPurpose],
  );

  return { id, url: publicUrl };
}
