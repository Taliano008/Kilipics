import type { ImageSourcePropType } from "react-native";

// Only a handful of categories have a real icon supplied so far. Anything
// else falls back to a text-glyph tile (see ProviderCard's own letter
// fallback pattern) rather than a missing/broken image.
const icons: Partial<Record<string, ImageSourcePropType>> = {
  spa: require("../../assets/icons/massage.png"),
  nails: require("../../assets/icons/nail-artist.png"),
  tattoo: require("../../assets/icons/tattoo.png"),
};

export const allCategoriesIcon: ImageSourcePropType = require("../../assets/icons/grid.png");

export function categoryIcon(id: string): ImageSourcePropType | null {
  return icons[id] ?? null;
}
