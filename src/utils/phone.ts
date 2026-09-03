// Normalizes Kenyan phone numbers to international format (+254...) for
// building tel:/WhatsApp links. Catalog data mixes local 07... formats with
// already-international ones. Returns null (never throws) for anything that
// doesn't resolve to a plausible Kenyan MSISDN, so callers just hide that
// contact channel instead of building a dead link.
export function normalizeKenyanPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digitsOnly = raw.trim().replace(/\D/g, "");
  if (/^254\d{9}$/.test(digitsOnly)) return `+${digitsOnly}`;
  if (/^0\d{9}$/.test(digitsOnly)) return `+254${digitsOnly.slice(1)}`;
  if (/^\d{9}$/.test(digitsOnly)) return `+254${digitsOnly}`;
  return null;
}
