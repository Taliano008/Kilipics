import { track } from "@/analytics/events";
import { useAnalyticsLifecycle } from "@/analytics/use-analytics-lifecycle";
import { AuthProvider } from "@/auth/auth-context";
import { CatalogProvider, useCatalog } from "@/catalog/catalog-context";
import { SavedProvider } from "@/saved/saved-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UpgradeGate } from "@/components/UpgradeGate";
import { colors } from "@/theme/tokens";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { type PropsWithChildren, useEffect, useRef } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://743083dead90d9d3c57d657aa756b762@o4512021410742272.ingest.de.sentry.io/4512021677408336",

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

void SplashScreen.preventAutoHideAsync().catch(() => {});

// The catalog's first load — a cache hit or the cold-start network fetch
// settling, success or failure either way — is what "resolved" means here.
// Dismissing on error too avoids ever leaving the splash stuck.
function SplashGate({ children }: PropsWithChildren) {
  const { loading } = useCatalog();
  const hidden = useRef(false);
  useEffect(() => {
    if (!loading && !hidden.current) {
      hidden.current = true;
      void SplashScreen.hideAsync();
    }
  }, [loading]);
  return children;
}

export default Sentry.wrap(function RootLayout() {
  useEffect(() => {
    void track("session_started", {
      pagePath: "/",
      pageTitle: "KiliPicks App",
    });
  }, []);
  useAnalyticsLifecycle();
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <CatalogProvider>
          <SplashGate>
            <SavedProvider>
              <AuthProvider>
                <UpgradeGate>
                  <StatusBar style="dark" />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.cream },
                      animation: "slide_from_right",
                    }}
                  >
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="provider/[id]" />
                    <Stack.Screen
                      name="booking/[providerId]"
                      options={{ presentation: "modal" }}
                    />
                    <Stack.Screen
                      name="auth"
                      options={{ presentation: "modal" }}
                    />
                  </Stack>
                </UpgradeGate>
              </AuthProvider>
            </SavedProvider>
          </SplashGate>
        </CatalogProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
});
