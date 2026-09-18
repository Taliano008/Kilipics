import { colors } from "@/theme/tokens";
import { Tabs } from "expo-router";
import { StyleSheet, Text } from "react-native";

const Icon = ({ symbol, active }: { symbol: string; active: boolean }) => (
  <Text style={[styles.icon, active && styles.activeIcon]}>{symbol}</Text>
);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.clay,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <Icon symbol="⌂" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ focused }) => <Icon symbol="⌕" active={focused} />,
        }}
      />
      {/* Saved still lives at /saved (linked from Account) — hidden from the
          thumb zone, not removed, so existing router.push("/saved") calls
          keep working. */}
      <Tabs.Screen
        name="saved"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ focused }) => <Icon symbol="◷" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ focused }) => <Icon symbol="◉" active={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  label: { fontSize: 11, fontWeight: "700" },
  icon: { color: colors.muted, fontSize: 26, lineHeight: 28 },
  activeIcon: { color: colors.clay },
});
