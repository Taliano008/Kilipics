import { MaterialIcons } from "@expo/vector-icons";
import { MerchantBusinessProvider } from "@/merchant/business-context";
import { BookingsProvider, useBookings } from "@/merchant/bookings-context";
import { SalesProvider } from "@/merchant/sales-context";
import { mc, mf } from "@/theme/merchant";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";

type IconName = keyof typeof MaterialIcons.glyphMap;

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
  const pendingToday = bookings.filter((b) => b.status === "pending").length;
  return (
    <View>
      <TabIcon name="calendar-today" color={color} />
      <Badge count={pendingToday} color={mc.primary} />
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: mc.primary,
        tabBarInactiveTintColor: mc.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: mc.surface,
          borderTopColor: mc.outlineVariant,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: mf.semibold, fontSize: 11, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color }) => <BookingsTabIcon color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
          tabBarIcon: ({ color }) => <TabIcon name="payments" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="looks"
        options={{
          title: "Looks",
          tabBarIcon: ({ color }) => <TabIcon name="photo-library" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color }) => <InboxTabIcon color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon name="storefront" color={String(color)} />,
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
