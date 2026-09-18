import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { execute } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest } from "../lib/http-errors.js";
import { env } from "../env.js";

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

// Saves one already-received multipart file part to disk under
// uploadsDir/merchants/<merchantId>/ and records it in media_uploads.
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

  const merchantDir = path.join(env.uploadsDir, "merchants", merchantId);
  await mkdir(merchantDir, { recursive: true });

  const id = newId();
  const filename = `${id}.${ext}`;
  const filePath = path.join(merchantDir, filename);
  // Always forward slashes in the stored path/URL, regardless of the OS
  // this happens to run on — file_path/public_url are shared across
  // whatever serves them later.
  const relativePath = `merchants/${merchantId}/${filename}`;

  await pipeline(file.file, createWriteStream(filePath));

  // @fastify/multipart truncates rather than throwing when the fileSize
  // limit (5MB, set where the plugin is registered) is hit — the stream
  // still "completes" successfully, just short. Clean up the partial file
  // rather than leaving a corrupt image behind.
  if (file.file.truncated) {
    await unlink(filePath).catch(() => {});
    throw badRequest("file_too_large", "That photo is too large. Please use one under 5MB.");
  }

  const { size: sizeBytes } = await stat(filePath);
  const publicUrl = `${env.uploadsBaseUrl}/${relativePath}`;

  await execute(
    `INSERT INTO media_uploads (id, merchant_id, business_id, file_path, public_url, content_type, size_bytes, purpose)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, merchantId, businessId ?? null, relativePath, publicUrl, file.mimetype, sizeBytes, resolvedPurpose],
  );

  return { id, url: publicUrl };
}
