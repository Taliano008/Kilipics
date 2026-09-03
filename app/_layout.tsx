import { track } from "@/analytics/events";
import { useAnalyticsLifecycle } from "@/analytics/use-analytics-lifecycle";
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

export default function RootLayout() {
  useEffect(() => { void track("session_started", { pagePath: "/", pageTitle: "KiliPicks App" }); }, []);
  useAnalyticsLifecycle();
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <CatalogProvider>
          <SplashGate>
            <SavedProvider>
              <UpgradeGate>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream }, animation: "slide_from_right" }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="provider/[id]" />
                  <Stack.Screen name="booking/[providerId]" options={{ presentation: "modal" }} />
                </Stack>
              </UpgradeGate>
            </SavedProvider>
          </SplashGate>
        </CatalogProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
