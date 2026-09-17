import { normalizeKenyanPhone } from "@/utils/phone";
import * as Linking from "expo-linking";

// Same native-scheme pattern already established in app/(tabs)/account.tsx
// and src/utils/contact-links.ts — `whatsapp://send?phone=...`, not the
// `wa.me` web fallback, checked with canOpenURL first so a device without
// WhatsApp installed doesn't hit a dead link.
export async function openWhatsapp(phone: string, text?: string) {
  const digits = (normalizeKenyanPhone(phone) || phone).replace(/^\+/, "");
  const url = `whatsapp://send?phone=${digits}${text ? `&text=${encodeURIComponent(text)}` : ""}`;
  const ok = await Linking.canOpenURL(url).catch(() => false);
  if (ok) void Linking.openURL(url);
  return ok;
}
