import Constants from "expo-constants";
import { Platform } from "react-native";

// In development the backend runs on the same computer as Metro, so the host
// the app loaded its bundle from is the backend's host too — no .env edit
// needed when the computer's IP changes. Which field carries it varies by
// Expo Go version and launch mode, so try each ("<host>:<port>" or a URL).
function hostFrom(value?: string | null): string | undefined {
  if (!value) return undefined;
  const host = value.replace(/^[a-z]+:\/\//i, "").split(/[:/]/)[0];
  return host || undefined;
}
const devHost = __DEV__
  ? hostFrom(Constants.expoConfig?.hostUri) ??
    hostFrom(Constants.expoGoConfig?.debuggerHost) ??
    hostFrom(Constants.linkingUri)
  : undefined;
const localHost =
  devHost || (Platform.OS === "android" ? "10.0.2.2" : "localhost");
const localBackendBase = `http://${localHost}:3000`;

// In web development, route through the same-origin Metro proxy configured in
// metro.config.js so the browser never makes a cross-origin request. This also
// prevents an Android-emulator-only URL such as 10.0.2.2 from being used by a
// desktop browser.
const webBackendProxyBase = "/auth-proxy";
const usesWebDevProxy = __DEV__ && Platform.OS === "web";

// The Fastify/Postgres backend in backend/ serves everything: the public
// catalog, analytics ingest, auth, and uploaded photos. Set
// EXPO_PUBLIC_API_BASE_URL to a deployed URL for a production build.
export const API_BASE_URL = (
  usesWebDevProxy
    ? webBackendProxyBase
    : process.env.EXPO_PUBLIC_API_BASE_URL || localBackendBase
).replace(/\/$/, "");

// Kept as its own export for the auth/merchant/upload call sites; it only
// differs from API_BASE_URL if EXPO_PUBLIC_AUTH_API_BASE_URL is set.
export const AUTH_API_BASE_URL = (
  usesWebDevProxy
    ? webBackendProxyBase
    : process.env.EXPO_PUBLIC_AUTH_API_BASE_URL || API_BASE_URL
).replace(/\/$/, "");

// Uploaded photos are stored as backend-relative paths ("/uploads/...") so
// they keep working when the backend's address changes; this turns them into
// a loadable URL. Anything that already has a scheme (https:, file:,
// content:, data:, ...) is returned as is — e.g. a photo just picked on the
// device, or an older row that stored a full URL.
export function resolveMediaUrl(value?: string | null) {
  if (!value || value.startsWith("provider-placeholder://")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

// Support channel — sourced from env so the placeholder can be swapped to a
// real number without a code change. BLOCKED on the product owner supplying a
// real WhatsApp number (see STATUS.md "Outstanding blockers"); until then the
// Account tab's "Get help" row stays disabled. The empty string default keeps
// the rest of the app typecheck-green and lets the support row render as
// "coming soon" rather than a dead control that links to nowhere.
export const SUPPORT_WHATSAPP_NUMBER =
  process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP_NUMBER ?? "";

export const ANALYTICS_APP_TOKEN =
  process.env.EXPO_PUBLIC_ANALYTICS_APP_TOKEN ||
  "i3Ts-OPgCz027AYcM-TODngfBYQvej1oEnViEVifkZs";
