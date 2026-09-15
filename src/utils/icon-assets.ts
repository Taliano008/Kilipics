import type { ImageSourcePropType } from "react-native";

// Small set of standalone (non-category) icon assets reused across the app
// — kept in one place, same pattern as category-icons.ts, so a given glyph
// (a rating star, the WhatsApp brand mark, a verified badge, the saved/heart
// mark) always maps to the same file instead of drifting per screen.
export const starIcon: ImageSourcePropType = require("../../assets/icons/icons8-star-48.png");
export const whatsappIcon: ImageSourcePropType = require("../../assets/icons/icons8-whatsapp-logo-48.png");
export const verifiedBadgeIcon: ImageSourcePropType = require("../../assets/icons/icons8-verified-badge-color-96.png");
export const savedIcon: ImageSourcePropType = require("../../assets/icons/saved.png");
