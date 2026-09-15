import * as ImagePicker from "expo-image-picker";

export type PickedPhoto = { uri: string; name: string; mimeType: string };

// permissionDenied lets callers show "you'll need to allow access in
// Settings" copy instead of just silently doing nothing when the picker
// comes back empty for a reason the user can actually act on.
export type PhotoPickResult =
  | { status: "picked"; photo: PickedPhoto }
  | { status: "canceled" }
  | { status: "permission_denied" };

function toPickedPhoto(asset: ImagePicker.ImagePickerAsset): PickedPhoto {
  const fallbackExt = asset.uri.split(".").pop()?.toLowerCase();
  const name =
    asset.fileName ||
    asset.uri.split("/").pop() ||
    `photo-${Date.now()}.${fallbackExt === "png" ? "png" : "jpg"}`;
  const mimeType =
    asset.mimeType ||
    (fallbackExt === "png"
      ? "image/png"
      : fallbackExt === "webp"
        ? "image/webp"
        : fallbackExt === "heic"
          ? "image/heic"
          : "image/jpeg");
  return { uri: asset.uri, name, mimeType };
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
  return { status: "picked", photo: toPickedPhoto(result.assets[0]) };
}

export async function takePhotoWithCamera(): Promise<PhotoPickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: "permission_denied" };

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return { status: "canceled" };
  return { status: "picked", photo: toPickedPhoto(result.assets[0]) };
}
