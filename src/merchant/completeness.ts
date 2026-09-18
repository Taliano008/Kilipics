import type { MerchantBusiness } from "@/api/merchant";

export type CompletenessField = {
  key: "phone" | "address" | "hours" | "photo";
  label: string;
};

const FIELDS: CompletenessField[] = [
  { key: "phone", label: "Contact phone number" },
  { key: "address", label: "Business address" },
  { key: "hours", label: "Weekly operating hours" },
  { key: "photo", label: "Cover or storefront photo" },
];

// The consumer catalog only gates on publication_status (see
// backend/src/services/catalog.js) — nothing stops an admin from
// publishing a listing missing these fields, so this is the mobile app's
// own nudge toward a listing that's actually useful to a browsing client.
export function getBusinessCompleteness(business: MerchantBusiness | null) {
  if (!business) return { missing: FIELDS, isComplete: false };

  const missing = FIELDS.filter((field) => {
    switch (field.key) {
      case "phone":
        return !business.phone?.trim();
      case "address":
        return !business.fullAddress?.trim();
      case "hours":
        return !business.hours?.trim();
      case "photo":
        return !business.coverUrl && (business.galleryUrls?.length ?? 0) === 0;
      default:
        return false;
    }
  });

  return { missing, isComplete: missing.length === 0 };
}
