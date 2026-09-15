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
          pass options and avoid "No route named" warnings on Android. */}
      <Stack.Screen name="profile" />
      <Stack.Screen name="services" />
      <Stack.Screen name="onboard/step1" />
      <Stack.Screen name="onboard/step2" />
      <Stack.Screen name="onboard/step3" />
      <Stack.Screen name="onboard/submitted" />
    </Stack>
  );
}
