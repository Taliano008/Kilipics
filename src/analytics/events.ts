import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/config/env";
import { Dimensions, Platform } from "react-native";

type EventName = "session_started" | "page_viewed" | "search_submitted" | "search_results_viewed" |
  "search_no_results" | "merchant_profile_viewed" | "merchant_saved" | "merchant_unsaved" |
  "booking_cta_clicked" | "booking_started";

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
const SESSION_KEY = "kilipicks.analytics.session.v1";
const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;

async function identity() {
  let anonymousUserId = await AsyncStorage.getItem(ANONYMOUS_KEY);
  if (!anonymousUserId) {
    anonymousUserId = createId("app_user");
    await AsyncStorage.setItem(ANONYMOUS_KEY, anonymousUserId);
  }
  let sessionId = await AsyncStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = createId("app_session");
    await AsyncStorage.setItem(SESSION_KEY, sessionId);
  }
  return { anonymousUserId, sessionId };
}

export async function track(eventName: EventName, properties: EventProperties = {}) {
  try {
    const { anonymousUserId, sessionId } = await identity();
    const { width, height } = Dimensions.get("window");
    const timestamp = new Date().toISOString();
    await fetch(`${API_BASE_URL}/api/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [{
          eventId: createId("app_event"), anonymousUserId, sessionId, eventName, timestamp,
          pagePath: properties.pagePath ?? "/app", pageTitle: properties.pageTitle,
          merchantId: properties.merchantId, merchantName: properties.merchantName,
          categoryId: properties.categoryId, categoryName: properties.categoryName,
          searchQuery: properties.searchQuery, sourceSurface: properties.sourceSurface ?? "mobile_app",
          sourceSection: properties.sourceSection, sourceItemType: properties.merchantId ? "merchant" : undefined,
          productVersion: "kilipicks-mobile@0.1.0", trackingSchemaVersion: "2.0",
          deviceType: "mobile-app", screenWidth: Math.round(width), screenHeight: Math.round(height),
          browser: "native-app", operatingSystem: `${Platform.OS} ${String(Platform.Version)}`,
          environment: __DEV__ ? "development" : "production",
          metadata: { channel: "mobile_app", ...properties.metadata },
        }],
      }),
    });
  } catch {
    // Analytics must never block the consumer experience.
  }
}
