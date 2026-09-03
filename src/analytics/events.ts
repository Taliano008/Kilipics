import AsyncStorage from "@react-native-async-storage/async-storage";
import { enqueue } from "@/analytics/queue";
import { Dimensions, Platform } from "react-native";

type EventName =
  | "session_started"
  | "page_viewed"
  | "search_submitted"
  | "search_results_viewed"
  | "search_no_results"
  | "merchant_profile_viewed"
  | "merchant_saved"
  | "merchant_unsaved"
  | "booking_cta_clicked"
  | "booking_started"
  | "contact_channel_clicked";

type EventProperties = {
  pagePath?: string;
  pageTitle?: string;
  merchantId?: string;
  merchantName?: string;
  categoryId?: string;
  categoryName?: string;
  searchQuery?: string;
  sourceSurface?: string;
  sourceSection?: string;
  metadata?: Record<string, unknown>;
};

const ANONYMOUS_KEY = "kilipicks.analytics.anonymous.v1";
const SESSION_KEY = "kilipicks.analytics.session.v2";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const createId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;

// Memoized so concurrent track() calls on a fresh install await the same
// in-flight resolution instead of each independently racing
// AsyncStorage.getItem/setItem and possibly minting two different ids.
let identityPromise: Promise<{ anonymousUserId: string }> | null = null;

async function resolveIdentity(): Promise<{ anonymousUserId: string }> {
  let anonymousUserId = await AsyncStorage.getItem(ANONYMOUS_KEY);
  if (!anonymousUserId) {
    anonymousUserId = createId("app_user");
    await AsyncStorage.setItem(ANONYMOUS_KEY, anonymousUserId);
  }
  return { anonymousUserId };
}

function identity() {
  if (!identityPromise) identityPromise = resolveIdentity();
  return identityPromise;
}

type StoredSession = { sessionId: string; lastActivityAt: number };

// Not memoized like identity() — elapsed time must be re-checked on every
// call so a session correctly expires after 30 minutes of inactivity and is
// regenerated (lazily, on the next tracked event) once the app is used again.
async function resolveSession(): Promise<string> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  const stored = raw ? (JSON.parse(raw) as StoredSession) : null;
  const expired =
    !stored || Date.now() - stored.lastActivityAt > SESSION_TIMEOUT_MS;
  const sessionId = expired ? createId("app_session") : stored.sessionId;
  await AsyncStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ sessionId, lastActivityAt: Date.now() }),
  );
  return sessionId;
}

export async function track(
  eventName: EventName,
  properties: EventProperties = {},
) {
  try {
    const { anonymousUserId } = await identity();
    const sessionId = await resolveSession();
    const { width, height } = Dimensions.get("window");
    const timestamp = new Date().toISOString();
    await enqueue({
      eventId: createId("app_event"),
      anonymousUserId,
      sessionId,
      eventName,
      timestamp,
      pagePath: properties.pagePath ?? "/app",
      pageTitle: properties.pageTitle,
      merchantId: properties.merchantId,
      merchantName: properties.merchantName,
      categoryId: properties.categoryId,
      categoryName: properties.categoryName,
      searchQuery: properties.searchQuery,
      sourceSurface: properties.sourceSurface ?? "mobile_app",
      sourceSection: properties.sourceSection,
      sourceItemType: properties.merchantId ? "merchant" : undefined,
      productVersion: "kilipicks-mobile@0.1.0",
      trackingSchemaVersion: "2.0",
      deviceType: "mobile-app",
      screenWidth: Math.round(width),
      screenHeight: Math.round(height),
      browser: "native-app",
      operatingSystem: `${Platform.OS} ${String(Platform.Version)}`,
      environment: __DEV__ ? "development" : "production",
      metadata: { channel: "mobile_app", ...properties.metadata },
    });
  } catch {
    // Analytics must never block the consumer experience.
  }
}
