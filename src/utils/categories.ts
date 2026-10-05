const labels: Record<string, string> = {
  hair: "Hair & Braiding",
  wigs: "Wigs & Locs",
  nails: "Nails",
  facials: "Skin & Facials",
  spa: "Spa & Massage",
  makeup: "Makeup & Lashes",
  barbering: "Barbering",
  fitness: "Fitness",
  pilates: "Pilates",
  yoga: "Yoga",
  recovery: "Recovery",
};

// The catalog's canonical category ids, in display order — the one source
// of truth other pickers (e.g. merchant onboarding's category selector)
// should build off of, so a business created there lands in the same
// category customers already browse by instead of spawning its own orphan
// chip (search.tsx derives its filter chips from whatever categoryId values
// actually appear in the data, so an off-taxonomy id silently fragments).
export const CATALOG_CATEGORY_IDS = Object.keys(labels);

// Merchants may pick more than one category during onboarding, up to this
// many (the backend enforces the same cap).
export const MAX_BUSINESS_CATEGORIES = 5;

// Short names used by older data and home-screen links, mapped onto the
// canonical ids above so "barber" and "barbering" are one category, not two.
const CATEGORY_ALIASES: Record<string, string> = {
  barber: "barbering",
  gym: "fitness",
};

export function canonicalCategoryId(id: string) {
  return CATEGORY_ALIASES[id] ?? id;
}

// Every category a business is listed under, primary first. Falls back to
// the single categoryId for catalog payloads that predate categoryIds.
export function providerCategoryIds(provider: {
  categoryId: string;
  categoryIds?: string[];
}): string[] {
  return [
    ...new Set(
      [provider.categoryId, ...(provider.categoryIds ?? [])].map(canonicalCategoryId),
    ),
  ];
}

export function categoryLabel(id: string) {
  return (
    labels[id] ??
    id
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}
