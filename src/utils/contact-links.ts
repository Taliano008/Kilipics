import { normalizeKenyanPhone } from "@/utils/phone";
import type { PublicCatalogProvider } from "@/types/catalog";

export type ContactChannelKind = "whatsapp" | "call" | "website" | "instagram" | "tiktok" | "email";
export type ContactChannel = { kind: ContactChannelKind; label: string; url: string };

function isHttpUrl(value?: string): value is string {
  return Boolean(value && /^https?:\/\//i.test(value.trim()));
}

// Public contact information — safe to show even for unclaimed/limited
// listings. Only the in-app booking flow is gated on partnership status.
export function buildContactChannels(provider: PublicCatalogProvider): ContactChannel[] {
  const contacts = provider.publicContacts ?? {};
  const channels: ContactChannel[] = [];

  const whatsappNumber = normalizeKenyanPhone(contacts.whatsapp || contacts.phone || provider.phone);
  if (whatsappNumber) {
    channels.push({ kind: "whatsapp", label: "WhatsApp", url: `whatsapp://send?phone=${whatsappNumber.replace("+", "")}` });
  }

  const callNumber = normalizeKenyanPhone(contacts.phone || provider.phone);
  if (callNumber) {
    channels.push({ kind: "call", label: "Call", url: `tel:${callNumber}` });
  }

  if (isHttpUrl(contacts.website)) channels.push({ kind: "website", label: "Website", url: contacts.website.trim() });
  if (isHttpUrl(contacts.instagram)) channels.push({ kind: "instagram", label: "Instagram", url: contacts.instagram.trim() });
  if (isHttpUrl(contacts.tiktok)) channels.push({ kind: "tiktok", label: "TikTok", url: contacts.tiktok.trim() });
  if (contacts.email) channels.push({ kind: "email", label: "Email", url: `mailto:${contacts.email.trim()}` });

  return channels;
}
