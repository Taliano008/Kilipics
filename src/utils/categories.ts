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

export function categoryLabel(id: string) {
  return labels[id] ?? id.replace(/[-_]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
