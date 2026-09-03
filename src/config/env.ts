import { Platform } from "react-native";

const fallbackApiBase =
  "https://nairobi-local-picks-demo.hantianyang5.chatgpt.site";

// The public catalog backend has no CORS headers, so browser fetch() calls fail
// with "Failed to fetch". In web dev (no explicit EXPO_PUBLIC_API_BASE_URL set),
// route through the same-origin Metro proxy configured in metro.config.js instead.
const webDevProxyBase = "/kilipicks-proxy";
const usesWebDevProxy =
  __DEV__ && Platform.OS === "web" && !process.env.EXPO_PUBLIC_API_BASE_URL;

export const API_BASE_URL = (
  usesWebDevProxy
    ? webDevProxyBase
    : process.env.EXPO_PUBLIC_API_BASE_URL || fallbackApiBase
).replace(/\/$/, "");

export function resolveMediaUrl(value?: string | null) {
  if (!value || value.startsWith("provider-placeholder://")) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}
