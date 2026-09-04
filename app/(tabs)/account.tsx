import { track } from "@/analytics/events";
import { useAuth } from "@/auth/auth-context";
import { SUPPORT_WHATSAPP_NUMBER } from "@/config/env";
import { report } from "@/observability/report";
import { useSaved } from "@/saved/saved-context";
import { colors, radii, spacing } from "@/theme/tokens";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

export default function AccountScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const { ids } = useSaved();
  const savedCount = ids.size;
  const supportAvailable = SUPPORT_WHATSAPP_NUMBER.length > 0;
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

        <Text style={styles.sectionTitle}>Your account</Text>
        <Pressable
          style={styles.rowCard}
          onPress={() => {
            void track("page_viewed", {
              pagePath: "/saved",
              pageTitle: "Saved",
              sourceSection: "account",
            });
            router.push("/saved");
          }}
        >
          <View>
            <Text style={styles.rowTitle}>Your saved places</Text>
            <Text style={styles.rowCopy}>
              {savedCount === 0 ? "Nothing saved yet" : `${savedCount} saved`}
            </Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>

        <Pressable
          style={styles.rowCard}
          onPress={() => router.push("/auth")}
        >
          <View>
            <Text style={styles.rowTitle}>Switch to seller</Text>
            <Text style={styles.rowCopy}>
              List your business on KiliPicks
            </Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Support</Text>
        <Pressable
          style={[styles.rowCard, !supportAvailable && styles.rowDisabled]}
          disabled={!supportAvailable}
          onPress={() => {
            if (!supportAvailable) return;
            const url = `whatsapp://send?phone=${SUPPORT_WHATSAPP_NUMBER.replace(/^\+/, "")}`;
            void Linking.canOpenURL(url).then((ok) => {
              if (!ok) return;
              void Linking.openURL(url).catch((reason) =>
                report(reason, { scope: "support_whatsapp_open" }),
              );
            });
          }}
        >
          <View>
            <Text style={styles.rowTitle}>Get help</Text>
            <Text style={styles.rowCopy}>
              {supportAvailable
                ? "Chat with us on WhatsApp"
                : "Coming soon"}
            </Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>

        <Pressable
          style={styles.rowCard}
          onPress={() => router.push("/privacy")}
        >
          <View>
            <Text style={styles.rowTitle}>Privacy notice</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>

        <Text style={styles.version}>KiliPicks {APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, paddingBottom: 48 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900" },
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
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  rowCopy: { color: colors.muted, fontSize: 13, marginTop: 4 },
  rowArrow: { color: colors.muted, fontSize: 22 },
  rowDisabled: { opacity: 0.55 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.lg,
  },
  version: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.lg,
    textAlign: "center",
  },
});