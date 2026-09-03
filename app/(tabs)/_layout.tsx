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
        tabBarActiveTintColor: colors.brand,
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
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ focused }) => <Icon symbol="♡" active={focused} />,
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
    height: 82,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  label: { fontSize: 11, fontWeight: "700" },
  icon: { color: colors.muted, fontSize: 26, lineHeight: 28 },
  activeIcon: { color: colors.brand },
});
