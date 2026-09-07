// Reusable JSON-schema fragments so the same rule isn't retyped per route.
// No ajv-formats dependency (not in package.json) — email uses an explicit
// permissive pattern instead of format:"email".
export const emailSchema = { type: "string", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", maxLength: 255 };

// Length only, no complexity rule — per the spec, length is the only
// requirement that meaningfully improves security at this stage.
export const passwordSchema = { type: "string", minLength: 8, maxLength: 200 };

export const ulidSchema = { type: "string", pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" };
export const dateSchema = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
export const timeSchema = { type: "string", pattern: "^\\d{2}:\\d{2}(:\\d{2})?$" };

export const industryEnum = { type: "string", enum: ["beauty", "wellness"] };
export const priceTypeEnum = { type: "string", enum: ["fixed", "from", "range", "contact_for_price"] };
export const bookingMethodEnum = { type: "string", enum: ["kilipicks", "whatsapp", "phone", "external", "disabled"] };
export const locationTypeEnum = { type: "string", enum: ["FIXED_VENUE", "MOBILE_SERVICE", "BOTH"] };

// Splits a PATCH body into { updates, rejected } against an allowlist of
// editable keys — used by every merchant PATCH handler so admin-only fields
// fail loudly (422 forbidden_field) instead of being silently dropped.
export function pickAllowed(body, allowedKeys) {
  const updates = {};
  const rejected = [];
  for (const [key, value] of Object.entries(body ?? {})) {
    if (allowedKeys.includes(key)) updates[key] = value;
    else rejected.push(key);
  }
  return { updates, rejected };
}
