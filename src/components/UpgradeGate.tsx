import { useCatalog } from "@/catalog/catalog-context";
import { colors, radii, spacing } from "@/theme/tokens";
import { compareVersions } from "@/utils/version";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const runningVersion = Constants.expoConfig?.version ?? "0.0.0";
const androidPackage = Constants.expoConfig?.android?.package;

function openPlayStore() {
  if (!androidPackage) return;
  const marketUrl = `market://details?id=${androidPackage}`;
  const webUrl = `https://play.google.com/store/apps/details?id=${androidPackage}`;
  Linking.canOpenURL(marketUrl)
    .then((supported) => Linking.openURL(supported ? marketUrl : webUrl))
    .catch(() => Linking.openURL(webUrl));
}

// Forward-compatible: the catalog snapshot's appConfig field is optional and
// the current backend doesn't send it yet, so this gate never renders in
// production today. It's ready for whenever a minVersion floor is needed.
export function UpgradeGate({ children }: PropsWithChildren) {
  const { catalog } = useCatalog();
  const minVersion = catalog?.appConfig?.minVersion;
  const blocked =
    Boolean(minVersion) && compareVersions(runningVersion, minVersion!) < 0;

  if (!blocked) return children;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Update required</Text>
      <Text style={styles.copy}>
        {catalog?.appConfig?.message ??
          "Please update KiliPicks to keep using the app."}
      </Text>
      <Pressable style={styles.button} onPress={openPlayStore}>
        <Text style={styles.buttonText}>Open Play Store</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.cream,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: spacing.sm,
  },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
});
