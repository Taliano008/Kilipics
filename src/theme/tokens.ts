export const colors = {
  // New palette
  surface: "#FFFDF9",
  ink: "#1A1614",
  inkMuted: "#6E645D",
  clay: "#B3452B",
  moss: "#2F5D4B",
  sand: "#EDE4D8",
  white: "#FFFFFF",

  // Retain during migration
  muted: "#776D70",
  brand: "#8A2343",
  brandDark: "#68172F",
  forest: "#0B6B50",
  cream: "#F8F4F1",
  blush: "#F7E9EC",
  card: "#FFFFFF",
  line: "#E8DFDC",
  warning: "#8B5A12",
  warningBg: "#FFF3D9",
  successBg: "#EAF5F0",
} as const;

export const radii = { sm: 12, md: 18, lg: 26, pill: 999 } as const;
export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 } as const;

export const shadow = {
  boxShadow: "0px 8px 18px rgba(41, 24, 30, 0.08)",
  elevation: 3,
} as const;
