import { track } from "@/analytics/events";
import { useAnalyticsLifecycle } from "@/analytics/use-analytics-lifecycle";
import { AuthProvider } from "@/auth/auth-context";
import { CatalogProvider } from "@/catalog/catalog-context";
import { SavedProvider } from "@/saved/saved-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UpgradeGate } from "@/components/UpgradeGate";
import { colors } from "@/theme/tokens";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";

Sentry.init({
  // Set in .env (local) / EAS secrets (builds). Leaving it unset disables
  // Sentry rather than crashing, so this is safe to omit in dev.
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,

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

import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

export default Sentry.wrap(function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    void track("session_started", {
      pagePath: "/",
      pageTitle: "KiliPicks App",
    });
  }, []);
  useAnalyticsLifecycle();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;


  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <CatalogProvider>
          <SavedProvider>
            <AuthProvider>
              <UpgradeGate>
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.sand },
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
                  <Stack.Screen
                    name="search-overlay"
                    options={{ presentation: "modal" }}
                  />
                  {/* ── Merchant screens (sub-routes auto-discovered by file-system routing) ── */}
                  <Stack.Screen name="merchant" />
                </Stack>
              </UpgradeGate>
            </AuthProvider>
          </SavedProvider>
        </CatalogProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
});
