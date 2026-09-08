import { track } from "@/analytics/events";
import { useAuth } from "@/auth/auth-context";
import { SUPPORT_WHATSAPP_NUMBER } from "@/config/env";
import { report } from "@/observability/report";
import { useSaved } from "@/saved/saved-context";
import { colors, radii, spacing } from "@/theme/tokens";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

export default function AccountScreen() {
  const router = useRouter();
  const { status, user, merchant, merchantNeedsSignIn, signOut, becomeMerchant } = useAuth();
  const [sellerFormOpen, setSellerFormOpen] = useState(false);
  const [sellerBusinessName, setSellerBusinessName] = useState("");
  const [sellerPassword, setSellerPassword] = useState("");
  const [sellerPending, setSellerPending] = useState(false);
  const [sellerMessage, setSellerMessage] = useState<string | null>(null);
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

  const submitBecomeSeller = async () => {
    if (sellerBusinessName.trim().length < 2) return setSellerMessage("Enter your business name.");
    if (sellerPassword.length < 8) return setSellerMessage("Your business password needs at least 8 characters.");
    setSellerPending(true);
    setSellerMessage(null);
    try {
      await becomeMerchant({ fullName: sellerBusinessName.trim(), password: sellerPassword });
      setSellerFormOpen(false);
      setSellerBusinessName("");
      setSellerPassword("");
    } catch (reason) {
      report(reason, { scope: "become_merchant" });
      setSellerMessage(
        reason instanceof Error ? reason.message : "We couldn't create your business account. Try again.",
      );
    } finally {
      setSellerPending(false);
    }
  };

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
        {status === "signed_in" && user ? (
          <View style={styles.signedInCard}>
            <View>
              <Text style={styles.signedInTitle}>{user.fullName}</Text>
              <Text style={styles.signedInCopy}>{user.email}</Text>
              <Text style={styles.signedInCopy}>
                {merchant ? "Customer and business owner" : "Customer account"}
              </Text>
            </View>
            <Pressable
              style={styles.signOutButton}
              onPress={() => void signOut()}
              accessibilityLabel="Sign out"
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>
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
          disabled={Boolean(merchant)}
          onPress={() => {
            if (status !== "signed_in") return router.push("/auth");
            if (merchant) return;
            setSellerMessage(null);
            setSellerFormOpen((open) => !open);
          }}
        >
          <View style={styles.rowFill}>
            <Text style={styles.rowTitle}>
              {merchant
                ? "Merchant access enabled"
                : merchantNeedsSignIn
                  ? "Business account needs sign-in"
                  : "Switch to seller"}
            </Text>
            <Text style={styles.rowCopy}>
              {merchant
                ? "You can still use KiliPicks as a customer"
                : merchantNeedsSignIn
                  ? "Your business password was changed separately — a dedicated sign-in is coming soon"
                  : "List your business on KiliPicks"}
            </Text>
          </View>
          {merchant ? null : <Text style={styles.rowArrow}>{sellerFormOpen ? "⌄" : "›"}</Text>}
        </Pressable>

        {sellerFormOpen && !merchant ? (
          <View style={styles.sellerForm}>
            <Text style={styles.label}>Business name</Text>
            <TextInput
              style={styles.input}
              value={sellerBusinessName}
              onChangeText={setSellerBusinessName}
              placeholder="Your business name"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              editable={!sellerPending}
            />
            <Text style={styles.label}>Business password</Text>
            <TextInput
              style={styles.input}
              value={sellerPassword}
              onChangeText={setSellerPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.muted}
              secureTextEntry
              textContentType="newPassword"
              editable={!sellerPending}
            />
            <Text style={styles.sellerHint}>
              This creates a separate business account under your email — its own password, kept apart from your
              customer sign-in.
            </Text>
            {sellerMessage ? <Text style={styles.message}>{sellerMessage}</Text> : null}
            <Pressable
              style={[styles.sellerSubmit, sellerPending && styles.disabled]}
              disabled={sellerPending}
              onPress={submitBecomeSeller}
            >
              {sellerPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.sellerSubmitText}>Create business account</Text>
              )}
            </Pressable>
          </View>
        ) : null}

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
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: spacing.lg, paddingBottom: 48 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900" },
  signInCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  signInTitle: { color: colors.white, fontSize: 17, fontWeight: "800" },
  signInCopy: { color: "#F9EDEF", fontSize: 13, marginTop: 4 },
  signInArrow: { color: colors.white, fontSize: 26 },
  signedInCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  signedInTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  signedInCopy: { color: colors.muted, fontSize: 13, marginTop: 4 },
  signOutButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.clay,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signOutText: { color: colors.clay, fontSize: 13, fontWeight: "800" },
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
  rowFill: { flex: 1, paddingRight: spacing.md },
  rowTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  rowCopy: { color: colors.muted, fontSize: 13, marginTop: 4 },
  rowArrow: { color: colors.muted, fontSize: 22 },
  rowDisabled: { opacity: 0.55 },
  sellerForm: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: spacing.lg,
    marginTop: -spacing.lg + 1,
    gap: 4,
  },
  label: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: spacing.sm, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  sellerHint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  message: { color: colors.warning, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  sellerSubmit: {
    marginTop: spacing.md,
    backgroundColor: colors.clay,
    borderRadius: radii.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  disabled: { opacity: 0.55 },
  sellerSubmitText: { color: colors.white, fontSize: 15, fontWeight: "900" },
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
