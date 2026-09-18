import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { execute } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest } from "../lib/http-errors.js";
import { env } from "../env.js";

// Same allowlist as merchant-media.js's ALLOWED_MIME_TO_EXT.
const ALLOWED_MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

// Saves the consumer's profile photo to disk under uploadsDir/users/<userId>/
// and updates users.photo_url directly — unlike merchant photos, a profile
// picture is a single field (not an array to merge client-side), so there's
// no separate "upload, then PATCH the field" round trip.
export async function saveUserPhotoUpload({ userId, file }) {
  if (!file) throw badRequest("no_file", "No photo was uploaded.");

  const ext = ALLOWED_MIME_TO_EXT[file.mimetype];
  if (!ext) {
    throw badRequest("unsupported_type", "Please upload a JPEG, PNG, WEBP, or HEIC photo.");
  }

  const userDir = path.join(env.uploadsDir, "users", userId);
  await mkdir(userDir, { recursive: true });

  const filename = `${newId()}.${ext}`;
  const filePath = path.join(userDir, filename);
  const relativePath = `users/${userId}/${filename}`;

  await pipeline(file.file, createWriteStream(filePath));

  // See merchant-media.js's saveMerchantPhotoUpload for why this check
  // exists: @fastify/multipart truncates rather than throwing when its
  // fileSize limit is hit.
  if (file.file.truncated) {
    await unlink(filePath).catch(() => {});
    throw badRequest("file_too_large", "That photo is too large. Please use one under 5MB.");
  }

  await stat(filePath);
  const publicUrl = `${env.uploadsBaseUrl}/${relativePath}`;

  await execute("UPDATE users SET photo_url = ? WHERE id = ?", [publicUrl, userId]);

  return { url: publicUrl };
}
