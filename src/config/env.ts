import Constants from "expo-constants";
import { Platform } from "react-native";

const fallbackApiBase =
  "https://nairobi-local-picks-demo.hantianyang5.chatgpt.site";

// If running via Expo Go on LAN, Constants.expoConfig?.hostUri contains "<host-ip>:<metro-port>"
// (e.g. "10.8.126.72:8081"). We extract the host IP so physical devices seamlessly reach the backend.
const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
const localHost =
  devHost || (Platform.OS === "android" ? "10.0.2.2" : "localhost");
const localAuthBase = `http://${localHost}:3000`;

// The public catalog backend has no CORS headers, so browser fetch() calls fail
// with "Failed to fetch". In web development always route through the
// same-origin Metro proxy configured in metro.config.js. This also prevents an
// Android-emulator-only URL such as 10.0.2.2 from being used by a desktop browser.
const webDevProxyBase = "/kilipicks-proxy";
const webAuthProxyBase = "/auth-proxy";
const usesWebDevProxy = __DEV__ && Platform.OS === "web";

export const API_BASE_URL = (
  usesWebDevProxy
    ? webDevProxyBase
    : process.env.EXPO_PUBLIC_API_BASE_URL || fallbackApiBase
).replace(/\/$/, "");

// Authentication is served by the Fastify/MySQL backend in backend/ (moved
// in from the former kilipicks-server repo). Set EXPO_PUBLIC_AUTH_API_BASE_URL
// to a LAN or deployed URL for a physical phone or a production build.
// On web dev we route through the Metro proxy (/auth-proxy) to avoid CORS.
export const AUTH_API_BASE_URL = (
  usesWebDevProxy
    ? webAuthProxyBase
    : process.env.EXPO_PUBLIC_AUTH_API_BASE_URL || localAuthBase
).replace(/\/$/, "");

export function resolveMediaUrl(value?: string | null) {
  if (!value || value.startsWith("provider-placeholder://")) return null;
  if (/^https?:\/\//i.test(value)) return value;
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
