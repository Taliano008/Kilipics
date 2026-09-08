import { useAuth } from "@/auth/auth-context";
import { report } from "@/observability/report";
import { colors, radii, spacing } from "@/theme/tokens";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Mode = "sign_in" | "sign_up";
type AccountType = "consumer" | "merchant";

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<Mode>("sign_up");
  const [accountType, setAccountType] = useState<AccountType>("consumer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isSignUp = mode === "sign_up";

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setMessage(null);
  };

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!isEmail(cleanEmail)) return setMessage("Enter a valid email address.");
    if (password.length < 8)
      return setMessage("Your password needs at least 8 characters.");
    if (isSignUp && name.trim().length < 2)
      return setMessage("Enter the name you would like us to use.");
    if (isSignUp && password !== confirmation)
      return setMessage("Your passwords do not match.");

    setPending(true);
    setMessage(null);
    try {
      if (isSignUp) {
        await signUpWithEmail({
          name: name.trim(),
          email: cleanEmail,
          password,
          accountType,
        });
      } else {
        await signInWithEmail({ email: cleanEmail, password });
      }
      router.back();
    } catch (reason) {
      report(reason, { scope: "email_auth", mode });
      setMessage(
        reason instanceof TypeError
          ? "We couldn't reach KiliPicks. Start the local auth server and try again."
          : reason instanceof Error
            ? reason.message
            : "We couldn't complete that request. Please try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Pressable
            style={styles.close}
            onPress={() => router.back()}
            accessibilityLabel="Close"
          >
            <Text style={styles.closeIcon}>×</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            {isSignUp ? "Create your account" : "Welcome back"}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? "Use one email account to discover venues and, if you choose, manage a business."
              : "Sign in to continue with your KiliPicks account."}
          </Text>

          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeOption, isSignUp && styles.modeOptionActive]}
              onPress={() => changeMode("sign_up")}
            >
              <Text style={[styles.modeText, isSignUp && styles.modeTextActive]}>Sign up</Text>
            </Pressable>
            <Pressable
              style={[styles.modeOption, !isSignUp && styles.modeOptionActive]}
              onPress={() => changeMode("sign_in")}
            >
              <Text style={[styles.modeText, !isSignUp && styles.modeTextActive]}>Sign in</Text>
            </Pressable>
          </View>

          {isSignUp ? (
            <>
              <Text style={styles.label}>I&apos;m joining as</Text>
              <View style={styles.accountTypes}>
                <Pressable
                  style={[
                    styles.accountType,
                    accountType === "consumer" && styles.accountTypeActive,
                  ]}
                  onPress={() => setAccountType("consumer")}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: accountType === "consumer" }}
                >
                  <Text style={styles.accountTypeTitle}>Customer</Text>
                  <Text style={styles.accountTypeCopy}>Discover and save venues</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.accountType,
                    accountType === "merchant" && styles.accountTypeActive,
                  ]}
                  onPress={() => setAccountType("merchant")}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: accountType === "merchant" }}
                >
                  <Text style={styles.accountTypeTitle}>Business owner</Text>
                  <Text style={styles.accountTypeCopy}>Also includes customer access</Text>
                </Pressable>
              </View>
              <Text style={styles.label}>Your name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                editable={!pending}
              />
            </>
          ) : null}

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!pending}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.muted}
            secureTextEntry
            textContentType={isSignUp ? "newPassword" : "password"}
            editable={!pending}
          />
          {isSignUp ? (
            <>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                textContentType="newPassword"
                editable={!pending}
              />
            </>
          ) : null}

          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable style={[styles.submit, pending && styles.disabled]} disabled={pending} onPress={submit}>
            {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>{isSignUp ? "Create account" : "Sign in"}</Text>}
          </Pressable>
          <Text style={styles.privacy}>
            By continuing, you agree to use KiliPicks responsibly. Password reset is not available yet.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { height: 56, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSpacer: { width: 42, height: 42 },
  close: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  closeIcon: { color: colors.ink, fontSize: 26, lineHeight: 28 },
  content: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: 48 },
  title: { color: colors.ink, fontSize: 29, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  modeSwitch: { flexDirection: "row", backgroundColor: colors.sand, borderRadius: radii.md, padding: 4, marginTop: spacing.lg },
  modeOption: { flex: 1, alignItems: "center", borderRadius: radii.sm, paddingVertical: 11 },
  modeOptionActive: { backgroundColor: colors.white },
  modeText: { color: colors.muted, fontWeight: "800" },
  modeTextActive: { color: colors.clay },
  label: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: spacing.lg, marginBottom: 8 },
  accountTypes: { gap: spacing.sm },
  accountType: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.md },
  accountTypeActive: { borderColor: colors.clay, borderWidth: 2, backgroundColor: colors.blush },
  accountTypeTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  accountTypeCopy: { color: colors.muted, fontSize: 13, marginTop: 3 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, color: colors.ink, fontSize: 16, paddingHorizontal: spacing.md, paddingVertical: 15 },
  message: { color: colors.warning, fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  submit: { marginTop: spacing.xl, backgroundColor: colors.clay, borderRadius: radii.md, alignItems: "center", minHeight: 54, justifyContent: "center", paddingHorizontal: spacing.md },
  disabled: { opacity: 0.55 },
  submitText: { color: colors.white, fontSize: 16, fontWeight: "900" },
  privacy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: spacing.md },
});
