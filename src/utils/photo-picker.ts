import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export type PickedPhoto = { uri: string; name: string; mimeType: string };

// A full-resolution modern phone photo (48MP+ sensors are common now) is
// routinely 5-15MB even at expo-image-picker's own quality:0.8 JPEG
// setting — that's over the backend's 10MB upload cap, so an un-resized
// camera capture reliably failed with "That photo is too large." Resizing
// the long edge down to a size that's still plenty sharp for mobile display,
// then re-encoding as JPEG, keeps every upload well under the cap.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.7;

// permissionDenied lets callers show "you'll need to allow access in
// Settings" copy instead of just silently doing nothing when the picker
// comes back empty for a reason the user can actually act on.
export type PhotoPickResult =
  | { status: "picked"; photo: PickedPhoto }
  | { status: "canceled" }
  | { status: "permission_denied" };

// Some OEM camera apps/OS versions report nonstandard mime types (e.g.
// "image/jpg" instead of "image/jpeg", or "image/heif" instead of
// "image/heic") or omit mimeType entirely. The backend only whitelists the
// canonical four types, so anything reported verbatim here needs
// normalizing first or a real photo gets rejected as "unsupported format".
function normalizeMimeType(mimeType: string | null | undefined, fallbackExt: string | undefined): string {
  const raw = (mimeType || "").toLowerCase();
  if (raw === "image/jpeg" || raw === "image/png" || raw === "image/webp" || raw === "image/heic") return raw;
  if (raw === "image/jpg") return "image/jpeg";
  if (raw === "image/heif") return "image/heic";
  if (fallbackExt === "png") return "image/png";
  if (fallbackExt === "webp") return "image/webp";
  if (fallbackExt === "heic" || fallbackExt === "heif") return "image/heic";
  return "image/jpeg";
}

function toPickedPhoto(asset: { uri: string; fileName?: string | null; mimeType?: string }): PickedPhoto {
  const fallbackExt = asset.uri.split(".").pop()?.toLowerCase();
  const name =
    asset.fileName ||
    asset.uri.split("/").pop() ||
    `photo-${Date.now()}.${fallbackExt === "png" ? "png" : "jpg"}`;
  const mimeType = normalizeMimeType(asset.mimeType, fallbackExt);
  return { uri: asset.uri, name, mimeType };
}

export async function compressPhoto(asset: { uri: string; width: number; height: number; mimeType?: string }): Promise<PickedPhoto> {
  try {
    const longEdge = Math.max(asset.width, asset.height);
    let context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
    if (longEdge > MAX_DIMENSION) {
      context =
        asset.width >= asset.height
          ? context.resize({ width: MAX_DIMENSION })
          : context.resize({ height: MAX_DIMENSION });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: saved.uri, name: `photo-${Date.now()}.jpg`, mimeType: "image/jpeg" };
  } catch {
    // Manipulation is a best-effort size guard, not a correctness
    // requirement — if it fails for any reason, fall back to the original
    // picked asset rather than blocking the upload entirely.
    return toPickedPhoto(asset);
  }
}

export async function pickPhotoFromLibrary(): Promise<PhotoPickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "permission_denied" };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return { status: "canceled" };
  return { status: "picked", photo: await compressPhoto(result.assets[0]) };
}
