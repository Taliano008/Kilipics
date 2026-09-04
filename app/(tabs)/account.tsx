import { track } from "@/analytics/events";
import { useAuth } from "@/auth/auth-context";
import { colors, radii, spacing } from "@/theme/tokens";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AccountScreen() {
  const router = useRouter();
  const { status } = useAuth();
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

        {status === "signed_out" ? (
          <Pressable
            style={styles.signInCard}
            onPress={() => router.push("/auth")}
          >
            <View>
              <Text style={styles.signInTitle}>Log in or sign up</Text>
              <Text style={styles.signInCopy}>
                Track your activity and get faster checkout
              </Text>
            </View>
            <Text style={styles.signInArrow}>›</Text>
          </Pressable>
        ) : null}

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
  signInCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.brandDark,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  signInTitle: { color: colors.white, fontSize: 17, fontWeight: "800" },
  signInCopy: { color: "#F9EDEF", fontSize: 13, marginTop: 4 },
  signInArrow: { color: colors.white, fontSize: 26 },
  version: { color: colors.muted, fontSize: 12, marginTop: spacing.lg },
});