import { colors, spacing } from "@/theme/tokens";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Pressable
          style={styles.close}
          onPress={() => router.back()}
          accessibilityLabel="Close"
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>PLACEHOLDER COPY</Text>
        <Text style={styles.title}>Privacy notice</Text>
        <Text style={styles.paragraph}>
          KiliPicks is built around an offline-first consumer experience: your
          saved places stay on your device, and the public merchant directory
          is cached locally so the app keeps working without a connection.
        </Text>
        <Text style={styles.paragraph}>
          What we collect by default:
        </Text>
        <Text style={styles.bullet}>
          {"\u2022 "}Anonymous usage events (page views, search submissions,
          save/unsave actions) so the team can see which categories are
          getting traction.
        </Text>
        <Text style={styles.bullet}>
          {"\u2022 "}Device and app metadata forwarded to Sentry for crash
          diagnostics when something goes wrong.
        </Text>
        <Text style={styles.paragraph}>What we do not collect yet:</Text>
        <Text style={styles.bullet}>
          {"\u2022 "}Your name, phone, email, or any contact details — the
          account backend is not live yet.
        </Text>
        <Text style={styles.bullet}>
          {"\u2022 "}Location, contacts, photos, or anything outside the public
          catalog.
        </Text>
        <Text style={styles.paragraph}>
          The text above is a placeholder. The full privacy notice is pending
          legal review per the Phase Zero PRD §5.4 — the wiring (route, screen,
          Account tab entry point) is in place so only the copy needs to
          change once it lands.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerSpacer: { flex: 1 },
  close: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: { color: colors.ink, fontSize: 22 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 5,
    marginBottom: spacing.md,
  },
  paragraph: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  bullet: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
    paddingLeft: spacing.md,
  },
});