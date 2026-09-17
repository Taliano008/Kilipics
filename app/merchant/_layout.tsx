import { Stack } from "expo-router";
import { mc } from "@/theme/merchant";

export default function MerchantLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: mc.surface },
        animation: "slide_from_right",
      }}
    >
      {/* Expo Router auto-discovers these files; we declare them here to
          pass options and avoid "No route named" warnings on Android.
          (dashboard) is the seller dashboard's own <Tabs> navigator
          (bookings/sales/looks/inbox/profile) — still reachable at
          /merchant/profile etc. since route groups are invisible in the
          URL. */}
      <Stack.Screen name="(dashboard)" />
      <Stack.Screen name="services" />
      <Stack.Screen name="onboard/step1" />
      <Stack.Screen name="onboard/step2" />
      <Stack.Screen name="onboard/step3" />
      <Stack.Screen name="onboard/submitted" />
    </Stack>
  );
}
