import { neu, neuBarTop, neuColors } from "@/theme/neumorphism";
import { colors } from "@/theme/tokens";
import { Image } from "expo-image";
import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// The active tab sits in a small pressed-in pill (soft UI, see
// src/theme/neumorphism.ts); the others rest flat on the bar.
const Icon = ({ symbol, active }: { symbol: string; active: boolean }) => (
  <View style={[styles.iconWell, active && neu.inset]}>
    <Text style={[styles.icon, active && styles.activeIcon]}>{symbol}</Text>
  </View>
);

// Same as Icon, for an image asset (an SVG renders through expo-image and is
// tinted like the text icons).
const AssetIcon = ({ source, active }: { source: number; active: boolean }) => (
  <View style={[styles.iconWell, active && neu.inset]}>
    <Image
      source={source}
      style={styles.assetIcon}
      tintColor={active ? colors.clay : colors.muted}
      contentFit="contain"
    />
  </View>
);

// Bootstrap Icons (assets/icons/*.svg), tinted per state by AssetIcon.
const searchIcon: number = require("../../assets/icons/search-heart.svg");
const activityIcon: number = require("../../assets/icons/activity.svg");
const accountIcon: number = require("../../assets/icons/person.svg");

// Icon well (30) + label + breathing room. Set explicitly: the default bar
// height is shorter than this content, which pushed the labels down into the
// Android navigation bar / gesture area. insets.bottom is then added on top,
// so the tappable part always ends above the system buttons.
const BAR_CONTENT_HEIGHT = 62;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // The screen shrinks above the keyboard (KeyboardAvoider in
        // app/_layout.tsx); without this the tab bar rides up with it.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.clay,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [
          styles.bar,
          { height: BAR_CONTENT_HEIGHT + insets.bottom, paddingBottom: insets.bottom + 6 },
        ],
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
          tabBarIcon: ({ focused }) => <AssetIcon source={searchIcon} active={focused} />,
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
          tabBarIcon: ({ focused }) => <AssetIcon source={activityIcon} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ focused }) => <AssetIcon source={accountIcon} active={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    ...neuBarTop,
    borderTopWidth: 0,
    paddingTop: 6,
  },
  label: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  iconWell: {
    width: 48,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: neuColors.surface,
  },
  icon: { color: colors.muted, fontSize: 24, lineHeight: 26 },
  assetIcon: { width: 22, height: 22 },
  activeIcon: { color: colors.clay },
});
