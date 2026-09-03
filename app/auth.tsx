import { useAuth } from "@/auth/auth-context";
import { report } from "@/observability/report";
import { colors, radii, spacing } from "@/theme/tokens";
import { normalizeKenyanPhone } from "@/utils/phone";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthScreen() {
  const router = useRouter();
  const { startPhoneAuth, startEmailAuth, startGoogleAuth } = useAuth();
  const [rawPhone, setRawPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const normalized = normalizeKenyanPhone(rawPhone);

  const runAuthPath = async (
    start: () => ReturnType<typeof startPhoneAuth>,
  ) => {
    setPending(true);
    setMessage(null);
    try {
      const result = await start();
      if (result.status !== "success") setMessage(result.message ?? null);
    } catch (reason) {
      report(reason, { scope: "auth_screen" });
      setMessage("Something went wrong. Please try again later.");
    } finally {
      setPending(false);
    }
  };

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

      <View style={styles.content}>
        <Text style={styles.title}>Log in or sign up</Text>
        <Text style={styles.subtitle}>
          We&apos;ll need to verify it&apos;s you
        </Text>

        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+254</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="712 345 678"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            value={rawPhone}
            onChangeText={setRawPhone}
            editable={!pending}
          />
        </View>
        <Text style={styles.helper}>
          We&apos;ll send you a verification code. Standard rates may apply.
        </Text>

        <Pressable
          style={[styles.continueButton, !normalized && styles.disabled]}
          disabled={!normalized || pending}
          onPress={() =>
            normalized && runAuthPath(() => startPhoneAuth(normalized))
          }
        >
          {pending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.continueText}>Continue</Text>
          )}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={styles.secondaryButton}
          disabled={pending}
          onPress={() => runAuthPath(startEmailAuth)}
        >
          <Text style={styles.secondaryText}>Continue with email</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          disabled={pending}
          onPress={() => runAuthPath(startGoogleAuth)}
        >
          <Text style={styles.secondaryText}>Continue with Google</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    height: 56,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSpacer: { width: 42, height: 42 },
  close: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: { color: colors.ink, fontSize: 18 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 8 },
  phoneRow: {
    flexDirection: "row",
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  countryCode: {
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  countryCodeText: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  phoneInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.ink,
  },
  helper: { color: colors.muted, fontSize: 13, marginTop: 10, lineHeight: 18 },
  continueButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    alignItems: "center",
    padding: 17,
  },
  disabled: { backgroundColor: "#B9AFB1" },
  continueText: { color: colors.white, fontSize: 16, fontWeight: "900" },
  message: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  secondaryButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    alignItems: "center",
    padding: 16,
  },
  secondaryText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
});
