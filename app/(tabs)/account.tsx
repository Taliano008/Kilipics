import { track } from "@/analytics/events";
import { API_BASE_URL } from "@/config/env";
import { colors, radii, spacing } from "@/theme/tokens";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AccountScreen() {
  useEffect(() => {
    void track("page_viewed", {
      pagePath: "/account",
      pageTitle: "Account",
      sourceSection: "account",
    });
  }, []);
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>KILIPICKS MOBILE MVP</Text>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.copy}>
          Sign-in is intentionally deferred until the consumer identity and
          privacy model are approved.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What works in this build</Text>
          {[
            "Live public merchant directory",
            "Search and category filters",
            "Local saved places",
            "Signed / unsigned listing rules",
            "Consumer behaviour analytics",
          ].map((item) => (
            <Text key={item} style={styles.row}>
              ✓ {item}
            </Text>
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next product decisions</Text>
          {[
            "Phone or social sign-in",
            "M-Pesa booking deposits",
            "Push notifications",
            "Maps and live distance",
            "Reviews and community publishing",
          ].map((item) => (
            <Text key={item} style={styles.row}>
              ○ {item}
            </Text>
          ))}
        </View>
        <Text style={styles.meta}>API environment</Text>
        <Text style={styles.url}>{API_BASE_URL}</Text>
        <Text style={styles.version}>
          KiliPicks Mobile 0.1.0 · Android-first / iOS-compatible
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, paddingBottom: 48 },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900", marginTop: 5 },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  row: { color: colors.ink, fontSize: 15, lineHeight: 29 },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.md,
  },
  url: { color: colors.brand, fontSize: 13, lineHeight: 19, marginTop: 6 },
  version: { color: colors.muted, fontSize: 12, marginTop: spacing.lg },
});
