/**
 * Merchant design tokens — derived from the Inspo HTML mockups.
 * Colour names follow the Material You naming scheme used in the Inspo files.
 */

export const mc = {
  // ── Core ──────────────────────────────────────────────────────────────────
  primary:                 "#a73400",
  onPrimary:               "#ffffff",
  primaryContainer:        "#cb4914",
  onPrimaryContainer:      "#fffbff",
  primaryFixed:            "#ffdbcf",
  primaryFixedDim:         "#ffb59c",
  onPrimaryFixed:          "#390c00",
  onPrimaryFixedVariant:   "#822700",
  inversePrimary:          "#ffb59c",

  // ── Secondary ─────────────────────────────────────────────────────────────
  secondary:               "#625d5a",
  onSecondary:             "#ffffff",
  secondaryContainer:      "#e6ded9",
  onSecondaryContainer:    "#67625e",
  secondaryFixed:          "#e9e1dc",
  secondaryFixedDim:       "#ccc5c0",
  onSecondaryFixed:        "#1e1b18",
  onSecondaryFixedVariant: "#4a4642",

  // ── Tertiary ──────────────────────────────────────────────────────────────
  tertiary:                "#006947",
  onTertiary:              "#ffffff",
  tertiaryContainer:       "#00855b",
  onTertiaryContainer:     "#f5fff6",
  tertiaryFixed:           "#6ffbbe",
  tertiaryFixedDim:        "#4edea3",
  onTertiaryFixed:         "#002113",
  onTertiaryFixedVariant:  "#005236",

  // ── Error ─────────────────────────────────────────────────────────────────
  error:                   "#ba1a1a",
  onError:                 "#ffffff",
  errorContainer:          "#ffdad6",
  onErrorContainer:        "#93000a",

  // ── Surface ───────────────────────────────────────────────────────────────
  surface:                 "#fcf9f4",
  onSurface:               "#1c1c19",
  surfaceBright:           "#fcf9f4",
  surfaceDim:              "#dcdad5",
  surfaceVariant:          "#e5e2dd",
  onSurfaceVariant:        "#594139",

  surfaceContainerLowest:  "#ffffff",
  surfaceContainerLow:     "#f6f3ee",
  surfaceContainer:        "#f0ede9",
  surfaceContainerHigh:    "#ebe8e3",
  surfaceContainerHighest: "#e5e2dd",

  inverseSurface:          "#31302d",
  inverseOnSurface:        "#f3f0eb",

  // ── Outline ───────────────────────────────────────────────────────────────
  outline:                 "#8d7168",
  outlineVariant:          "#e1bfb5",

  // ── Misc ──────────────────────────────────────────────────────────────────
  surfaceTint:             "#ab3600",
  background:              "#fcf9f4",
  onBackground:            "#1c1c19",
} as const;

/** Spacing scale matching the Inspo CSS custom properties */
export const ms = {
  "2xs": 4,
  xs:    8,
  sm:    12,
  md:    16,
  lg:    20,
  xl:    24,
  "2xl": 32,
  "3xl": 40,
} as const;

/** Border-radius scale */
export const mr = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  "2xl": 24,
  full: 9999,
} as const;

/** Font family names (loaded in root _layout) */
export const mf = {
  regular:   "PlusJakartaSans_400Regular",
  medium:    "PlusJakartaSans_500Medium",
  semibold:  "PlusJakartaSans_600SemiBold",
  bold:      "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;
