import { MaterialIcons } from "@expo/vector-icons";
import { MerchantBusinessProvider } from "@/merchant/business-context";
import { BookingsProvider, localIsoDate, useBookings } from "@/merchant/bookings-context";
import { SalesProvider } from "@/merchant/sales-context";
import { mc, mf } from "@/theme/merchant";
import { neu, neuBarTop, neuColors } from "@/theme/neumorphism";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = keyof typeof MaterialIcons.glyphMap;

// The active tab sits in a small pressed-in well (soft UI, matching the
// customer app — see src/theme/neumorphism.ts).
function TabWell({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View
      style={[
        { width: 52, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: neuColors.surface },
        focused && neu.inset,
      ]}
    >
      {children}
    </View>
  );
}

function TabIcon({ name, color, size = 24 }: { name: IconName; color: string; size?: number }) {
  return <MaterialIcons name={name} size={size} color={color} />;
}

function Badge({ count, color }: { count: number; color: string }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: "absolute",
        top: -4,
        right: -8,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 3,
        borderRadius: 8,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: mc.onPrimary, fontFamily: mf.bold, fontSize: 9, lineHeight: 11 }}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

function BookingsTabIcon({ color }: { color: string }) {
  const { bookings } = useBookings();
  // The store also holds earlier days of the month (for Sales) — only
  // pending bookings that are still ahead need action.
  const todayIso = localIsoDate();
  // ...plus customer cancellations the merchant hasn't dismissed yet.
  const pendingUpcoming = bookings.filter(
    (b) =>
      (b.status === "pending" && b.date >= todayIso) ||
      (b.cancelledBy === "customer" && !b.cancelAcknowledged),
  ).length;
  return (
    <View>
      <TabIcon name="calendar-today" color={color} />
      <Badge count={pendingUpcoming} color={mc.primary} />
    </View>
  );
}

function InboxTabIcon({ color }: { color: string }) {
  // No real inbox data model yet (Inbox is a live view over WhatsApp/support
  // links, not stored state — see plan) — this count mirrors the mockup's
  // illustrative unread badge rather than a computed value.
  return (
    <View>
      <TabIcon name="chat-bubble" color={color} />
      <Badge count={5} color={mc.tertiary} />
    </View>
  );
}

function DashboardTabs() {
  // A fixed height overrides the tab bar's own inset handling, so the
  // Android navigation bar / gesture area has to be added back explicitly
  // or it covers the icons (same approach as app/(tabs)/_layout.tsx).
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // See the same option in app/(tabs)/_layout.tsx.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: mc.primary,
        tabBarInactiveTintColor: mc.onSurfaceVariant,
        tabBarStyle: {
          ...neuBarTop,
          borderTopWidth: 0,
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontFamily: mf.semibold, fontSize: 11, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, focused }) => (
            <TabWell focused={focused}>
              <BookingsTabIcon color={String(color)} />
            </TabWell>
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
          tabBarIcon: ({ color, focused }) => (
            <TabWell focused={focused}>
              <TabIcon name="payments" color={String(color)} />
            </TabWell>
          ),
        }}
      />
      <Tabs.Screen
        name="looks"
        options={{
          title: "Looks",
          tabBarIcon: ({ color, focused }) => (
            <TabWell focused={focused}>
              <TabIcon name="photo-library" color={String(color)} />
            </TabWell>
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, focused }) => (
            <TabWell focused={focused}>
              <InboxTabIcon color={String(color)} />
            </TabWell>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabWell focused={focused}>
              <TabIcon name="storefront" color={String(color)} />
            </TabWell>
          ),
        }}
      />
    </Tabs>
  );
}

export default function DashboardLayout() {
  return (
    <MerchantBusinessProvider>
      <BookingsProvider>
        <SalesProvider>
          <DashboardTabs />
        </SalesProvider>
      </BookingsProvider>
    </MerchantBusinessProvider>
  );
}
