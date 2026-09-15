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

export function categoryLabel(id: string) {
  return (
    labels[id] ??
    id
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}
