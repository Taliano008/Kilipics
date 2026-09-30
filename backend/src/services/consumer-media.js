import { execute } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest } from "../lib/http-errors.js";
import { storeUpload } from "../lib/storage.js";

// Same allowlist as merchant-media.js's ALLOWED_MIME_TO_EXT.
const ALLOWED_MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

// Stores the consumer's profile photo under users/<userId>/ (Supabase
// Storage or local disk — see lib/storage.js) and updates users.photo_url directly — unlike merchant photos, a profile
// picture is a single field (not an array to merge client-side), so there's
// no separate "upload, then PATCH the field" round trip.
export async function saveUserPhotoUpload({ userId, file }) {
  if (!file) throw badRequest("no_file", "No photo was uploaded.");

  const ext = ALLOWED_MIME_TO_EXT[file.mimetype];
  if (!ext) {
    throw badRequest("unsupported_type", "Please upload a JPEG, PNG, WEBP, or HEIC photo.");
  }

  const relativePath = `users/${userId}/${newId()}.${ext}`;
  const { url: publicUrl } = await storeUpload({ relativePath, file });

  await execute("UPDATE users SET photo_url = ? WHERE id = ?", [publicUrl, userId]);

  return { url: publicUrl };
}
