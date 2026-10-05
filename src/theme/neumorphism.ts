/**
 * Neumorphism ("soft UI") for the customer app: elements share the page's
 * colour and stand out only through two shadows — a light one from the
 * top-left and a dark one to the bottom-right. Raised = sitting on the
 * surface; inset = pressed into it (used for inputs and the pressed state
 * of buttons, so taps feel physical).
 *
 * Started on the Home tab; reuse these on other screens rather than writing
 * new shadow values, so the light direction stays consistent everywhere.
 *
 * Relies on boxShadow with multiple and inset shadows (React Native's New
 * Architecture, enabled in android/gradle.properties).
 *
 * Accessibility: soft UI is low-contrast by nature. Keep text and icons at
 * full contrast (ink on the surface, white on photos) — only edges go soft.
 */
import type { ViewStyle } from "react-native";

export const neuColors = {
  // Mid-tone warm neutral: light enough for the white highlight to read,
  // dark enough for the white shadow to show at all on the top-left.
  surface: "#EFE9E2",
  ink: "#1C1A17",
  muted: "rgba(28,26,23,0.58)",
  accent: "#C1502E",
};

const LIGHT = "rgba(255,255,255,0.92)";
const DARK = "rgba(163,142,124,0.42)";

const shadow = (distance: number, blur: number) =>
  `-${distance}px -${distance}px ${blur}px ${LIGHT}, ${distance}px ${distance}px ${blur}px ${DARK}`;
const insetShadow = (distance: number, blur: number) =>
  `inset ${distance}px ${distance}px ${blur}px ${DARK}, inset -${distance}px -${distance}px ${blur}px ${LIGHT}`;

export const neu = {
  // Cards and large tiles.
  raised: { backgroundColor: neuColors.surface, boxShadow: shadow(6, 14) } satisfies ViewStyle,
  // Buttons, chips, small icons.
  raisedSm: { backgroundColor: neuColors.surface, boxShadow: shadow(3, 7) } satisfies ViewStyle,
  // Pressed-in: inputs, wells, and the pressed state of anything raised.
  inset: { backgroundColor: neuColors.surface, boxShadow: insetShadow(3, 6) } satisfies ViewStyle,
};

// For Pressable's style callback: raised at rest, pressed in while touched.
export function neuPressable(pressed: boolean, size: "lg" | "sm" = "lg"): ViewStyle {
  if (pressed) return neu.inset;
  return size === "sm" ? neu.raisedSm : neu.raised;
}

// Primary actions (Book, Try again, the selected chip) keep their accent fill
// so they still stand out — soft UI alone is too subtle for a main action —
// but sit on the surface with the same shadows and press in the same way.
export function neuAccent(pressed = false, color: string = neuColors.accent): ViewStyle {
  return {
    backgroundColor: color,
    boxShadow: pressed
      ? "inset 3px 3px 6px rgba(0,0,0,0.28), inset -2px -2px 5px rgba(255,255,255,0.18)"
      : shadow(3, 8),
  };
}

// The tab bar and other bars pinned to an edge: a soft shadow toward the
// content only.
export const neuBarTop: ViewStyle = {
  backgroundColor: neuColors.surface,
  boxShadow: `0px -4px 14px ${DARK}`,
};
export const neuBarBottom: ViewStyle = {
  backgroundColor: neuColors.surface,
  boxShadow: `0px 4px 14px ${DARK}`,
};

// Horizontal ScrollViews clip anything outside their bounds, which cuts the
// shadows off. Give the content room on every side for the 14px blur.
export const NEU_SHADOW_ROOM = 16;
