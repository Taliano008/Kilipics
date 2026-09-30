import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env.js";
import { ApiError, badRequest } from "./http-errors.js";

// Where uploaded photos live. Two backends behind one call:
//
//  - Supabase Storage, when SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
//    SUPABASE_STORAGE_BUCKET are all set. Files survive redeploys and are
//    served from Supabase's CDN; the stored URL is absolute.
//  - Local disk under env.uploadsDir otherwise, served by @fastify/static at
//    /uploads (see app.js). The stored URL is backend-relative. Fine for
//    development; on a host with an ephemeral filesystem every photo is
//    lost on the next deploy.
//
// The mobile app handles both URL shapes (resolveMediaUrl in
// src/config/env.ts), so rows written under either backend keep working
// after a switch.
export const usingSupabaseStorage = Boolean(
  env.supabaseUrl && env.supabaseServiceRoleKey && env.supabaseStorageBucket,
);

// Reads one @fastify/multipart file part fully into memory (capped at the
// plugin's 5MB fileSize limit) and stores it at relativePath, which must use
// forward slashes. Returns the URL to save and the size in bytes.
export async function storeUpload({ relativePath, file }) {
  const buffer = await file.toBuffer();

  // @fastify/multipart truncates rather than throwing when the fileSize
  // limit is hit — the read still "succeeds", just short. Checked before
  // anything is written so a corrupt image is never stored.
  if (file.file.truncated) {
    throw badRequest("file_too_large", "That photo is too large. Please use one under 5MB.");
  }

  if (usingSupabaseStorage) {
    const objectPath = `${env.supabaseStorageBucket}/${relativePath}`;
    const response = await fetch(`${env.supabaseUrl}/storage/v1/object/${objectPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": file.mimetype,
        // Filenames are unique ids, so a stored object never changes.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: buffer,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`Supabase Storage upload failed (${response.status}): ${detail.slice(0, 300)}`);
      throw new ApiError(502, "upload_failed", "We couldn't save that photo. Please try again.");
    }
    return {
      url: `${env.supabaseUrl}/storage/v1/object/public/${objectPath}`,
      sizeBytes: buffer.length,
    };
  }

  const filePath = path.join(env.uploadsDir, ...relativePath.split("/"));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return { url: `${env.uploadsBaseUrl}/${relativePath}`, sizeBytes: buffer.length };
}

// Deletes a stored upload, wherever it lives: a Supabase public URL is
// removed from the bucket, anything else is treated as a local file under
// uploadsDir. Best-effort — returns false rather than throwing, since the
// caller has already stopped the photo being shown and a leftover file is
// not worth failing that for.
export async function deleteUpload({ filePath, publicUrl }) {
  try {
    const supabasePrefix = `${env.supabaseUrl}/storage/v1/object/public/`;
    if (env.supabaseUrl && publicUrl?.startsWith(supabasePrefix)) {
      if (!env.supabaseServiceRoleKey) return false;
      const objectPath = publicUrl.slice(supabasePrefix.length);
      const response = await fetch(`${env.supabaseUrl}/storage/v1/object/${objectPath}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      });
      return response.ok;
    }
    if (!filePath || filePath.includes("..")) return false;
    await unlink(path.join(env.uploadsDir, ...filePath.split("/")));
    return true;
  } catch {
    return false;
  }
}
