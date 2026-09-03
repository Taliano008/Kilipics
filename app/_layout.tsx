import { track } from "@/analytics/events";
import { CatalogProvider } from "@/catalog/catalog-context";
import { SavedProvider } from "@/saved/saved-context";
import { UpgradeGate } from "@/components/UpgradeGate";
import { colors } from "@/theme/tokens";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  useEffect(() => { void track("session_started", { pagePath: "/", pageTitle: "KiliPicks App" }); }, []);
  return (
    <SafeAreaProvider>
      <CatalogProvider>
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
      </CatalogProvider>
    </SafeAreaProvider>
  );
}
