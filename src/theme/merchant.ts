/**
 * Merchant design tokens — derived from the Inspo HTML mockups.
 * Colour names follow the Material You naming scheme used in the Inspo files.
 */

export const mc = {
  // ── Core ──────────────────────────────────────────────────────────────────
  primary:                 "#99311f",
  onPrimary:               "#ffffff",
  primaryContainer:        "#ba4934",
  onPrimaryContainer:      "#ffedea",
  primaryFixed:            "#ffdad3",
  primaryFixedDim:         "#ffb4a5",
  onPrimaryFixed:          "#3f0400",
  onPrimaryFixedVariant:   "#852312",
  inversePrimary:          "#ffb4a5",

  // ── Secondary ─────────────────────────────────────────────────────────────
  secondary:               "#416658",
  onSecondary:             "#ffffff",
  secondaryContainer:      "#c1e8d7",
  onSecondaryContainer:    "#456a5c",
  secondaryFixed:          "#c3ebda",
  secondaryFixedDim:       "#a8cfbe",
  onSecondaryFixed:        "#002117",
  onSecondaryFixedVariant: "#294d41",

  // ── Tertiary ──────────────────────────────────────────────────────────────
  tertiary:                "#7a4b00",
  onTertiary:              "#ffffff",
  tertiaryContainer:       "#9b6100",
  onTertiaryContainer:     "#ffefe1",
  tertiaryFixed:           "#ffddb9",
  tertiaryFixedDim:        "#ffb962",
  onTertiaryFixed:         "#2b1700",
  onTertiaryFixedVariant:  "#663e00",

  // ── Error ─────────────────────────────────────────────────────────────────
  error:                   "#ba1a1a",
  onError:                 "#ffffff",
  errorContainer:          "#ffdad6",
  onErrorContainer:        "#93000a",

  // ── Surface ───────────────────────────────────────────────────────────────
  surface:                 "#fef8f5",
  onSurface:               "#1d1b1a",
  surfaceBright:           "#fef8f5",
  surfaceDim:              "#ded9d6",
  surfaceVariant:          "#e7e1de",
  onSurfaceVariant:        "#57423d",

  surfaceContainerLowest:  "#ffffff",
  surfaceContainerLow:     "#f8f2ef",
  surfaceContainer:        "#f3edea",
  surfaceContainerHigh:    "#ede7e4",
  surfaceContainerHighest: "#e7e1de",

  inverseSurface:          "#32302e",
  inverseOnSurface:        "#f5f0ed",

  // ── Outline ───────────────────────────────────────────────────────────────
  outline:                 "#8b716c",
  outlineVariant:          "#dec0ba",

  // ── Misc ──────────────────────────────────────────────────────────────────
  surfaceTint:             "#a63a27",
  background:              "#fef8f5",
  onBackground:            "#1d1b1a",
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
