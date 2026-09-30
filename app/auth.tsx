/**
 * app/auth.tsx — welcome, create account, log in, and the "all set" screen.
 * Layout: Inspo/KiliPicks Auth.html.
 *
 * One route, four steps held in local state, so the form survives moving
 * between them and the whole flow dismisses back to wherever it was opened
 * from (e.g. a half-filled booking form).
 *
 * The mockup also shows "Continue with Google", phone sign-in and its
 * code-entry step. None of those has a backend (no OAuth client, no SMS
 * provider), so they are left out rather than shown as buttons that can't
 * work. "Forgot password?" is kept, as the mockup has it, as an honest
 * "coming soon".
 */
import { useAuth } from "@/auth/auth-context";
import { report } from "@/observability/report";
import { mf } from "@/theme/merchant";
import { colors, radii } from "@/theme/tokens";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Step = "welcome" | "signup" | "login" | "done";
type AccountType = "consumer" | "merchant";
type FieldKey = "name" | "email" | "pw" | "pw2" | "agree";
type IconName = keyof typeof MaterialIcons.glyphMap;

const heroImage = require("../assets/images/auth-welcome.jpg");
const logoMark = require("../assets/images/kilipicks-mark.png");

const ERROR = "#BA1A1A";
const BORDER_STRONG = "#CFC3BD";
const BACK_BG = "#F3EDE5";
const TOAST_MS = 2600;

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// The seller side of the app has its own, slightly deeper palette
// (src/theme/merchant.ts); picking "Business owner" shifts to it.
function palette(type: AccountType) {
  const seller = type === "merchant";
  return {
    accent: seller ? "#A73400" : colors.clay,
    accentSoft: seller ? "#FFEDE5" : colors.blush,
    green: seller ? "#006947" : colors.moss,
    greenSoft: seller ? "#E1F2EA" : "#E3EDE8",
  };
}

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail } = useAuth();

  const [step, setStep] = useState<Step>("welcome");
  const [accountType, setAccountType] = useState<AccountType>("consumer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [agree, setAgree] = useState(false);
  const [keep, setKeep] = useState(true);
  // Field errors only appear once a submit has been attempted.
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);
  const [focus, setFocus] = useState<FieldKey | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const { accent, accentSoft, green, greenSoft } = palette(accountType);

  const go = (next: Step) => {
    setStep(next);
    setTried(false);
    setFocus(null);
    setServerError(null);
  };

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const errors: Partial<Record<FieldKey, string>> = {};
  if (tried) {
    if (step === "signup" && name.trim().length < 2) {
      errors.name = "Enter the name you would like us to use.";
    }
    if (!isEmail(email.trim())) errors.email = "Enter a valid email address.";
    if (pw.length < 8) errors.pw = "Your password needs at least 8 characters.";
    if (step === "signup" && (!pw2 || pw2 !== pw)) errors.pw2 = "Your passwords do not match.";
    if (step === "signup" && !agree) errors.agree = "Please accept the Privacy Policy to continue.";
  }

  const isValid = () =>
    isEmail(email.trim()) &&
    pw.length >= 8 &&
    (step !== "signup" || (name.trim().length >= 2 && pw2 === pw && agree));

  const submit = async () => {
    setTried(true);
    if (pending || !isValid()) return;

    const cleanEmail = email.trim().toLowerCase();
    setPending(true);
    setServerError(null);
    try {
      if (step === "signup") {
        await signUpWithEmail({ name: name.trim(), email: cleanEmail, password: pw, accountType });
        go("done");
      } else {
        await signInWithEmail({ email: cleanEmail, password: pw, remember: keep });
        close();
      }
    } catch (reason) {
      report(reason, { scope: "email_auth", mode: step });
      setServerError(
        reason instanceof TypeError
          ? "We couldn't reach KiliPicks. Check your connection and try again."
          : reason instanceof Error
            ? reason.message
            : "We couldn't complete that request. Please try again.",
      );
    } finally {
      setPending(false);
    }
  };

  const borderFor = (key: FieldKey) =>
    errors[key] ? ERROR : focus === key ? accent : colors.line;

  // 0–4: length, an uppercase letter, a digit, a symbol.
  const strength = [pw.length >= 8, /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(
    Boolean,
  ).length;
  const strengthColor = [colors.line, ERROR, "#C98A1A", green, green][strength];
  const strengthLabel = ["Too weak", "Weak", "Fair", "Good", "Strong"][strength];

  const firstName = name.trim().split(/\s+/)[0] || "there";
  const seller = accountType === "merchant";

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {step === "welcome" && (
          <View style={s.welcome}>
            <View style={s.brandRow}>
              <Image source={logoMark} style={s.logo} contentFit="cover" />
              <Text style={s.brand}>KiliPicks</Text>
              <Pressable style={s.closeBtn} onPress={close} accessibilityLabel="Close">
                <MaterialIcons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>
            <Image source={heroImage} style={s.hero} contentFit="cover" transition={150} />
            <View style={{ gap: 8 }}>
              <Text style={s.title}>Welcome</Text>
              <Text style={s.lead}>
                Discover salons, spas, barbers and more near you. Log in or sign up to continue.
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              <Pressable
                style={[s.primaryBtn, { backgroundColor: accent }]}
                onPress={() => go("signup")}
              >
                <Text style={s.primaryBtnText}>Create account</Text>
              </Pressable>
              <Pressable style={s.outlineBtn} onPress={() => go("login")}>
                <Text style={s.outlineBtnText}>I already have an account</Text>
              </Pressable>
            </View>
          </View>
        )}

        {(step === "signup" || step === "login") && (
          <ScrollView
            contentContainerStyle={s.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={s.backBtn} onPress={() => go("welcome")} accessibilityLabel="Back">
              <MaterialIcons name="chevron-left" size={24} color={colors.ink} />
            </Pressable>
            <View style={{ gap: 6 }}>
              <Text style={s.title}>{step === "signup" ? "Create account" : "Log in"}</Text>
              <Text style={s.lead}>{step === "signup" ? "Sign up to continue" : "Welcome back!"}</Text>
            </View>

            {step === "signup" && (
              <>
                <View style={s.field}>
                  <Text style={s.label}>I&apos;m joining as</Text>
                  <View style={s.typeRow}>
                    {(
                      [
                        ["consumer", "Customer", "Discover and book services"],
                        ["merchant", "Business owner", "Also includes customer access"],
                      ] as const
                    ).map(([type, heading, copy]) => {
                      const on = accountType === type;
                      return (
                        <Pressable
                          key={type}
                          style={[
                            s.typeCard,
                            on && { borderColor: accent, backgroundColor: accentSoft },
                          ]}
                          onPress={() => setAccountType(type)}
                          disabled={pending}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={s.typeTitle}>{heading}</Text>
                          <Text style={s.typeCopy}>{copy}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <Field
                  label="Your name"
                  icon="person-outline"
                  border={borderFor("name")}
                  error={errors.name}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocus("name")}
                  onBlur={() => setFocus(null)}
                  placeholder="Your name"
                  autoCapitalize="words"
                  textContentType="name"
                  editable={!pending}
                />
              </>
            )}

            <Field
              label="Email"
              icon="mail-outline"
              border={borderFor("email")}
              error={errors.email}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocus("email")}
              onBlur={() => setFocus(null)}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!pending}
            />

            <Field
              label="Password"
              icon="lock-outline"
              border={borderFor("pw")}
              error={errors.pw}
              value={pw}
              onChangeText={setPw}
              onFocus={() => setFocus("pw")}
              onBlur={() => setFocus(null)}
              placeholder={step === "signup" ? "Create password" : "Enter password"}
              secureTextEntry={!showPw}
              onToggleSecure={() => setShowPw((v) => !v)}
              autoCapitalize="none"
              textContentType={step === "signup" ? "newPassword" : "password"}
              editable={!pending}
            >
              {step === "signup" && pw.length > 0 && (
                <View style={s.strengthRow}>
                  <View style={s.strengthBars}>
                    {[0, 1, 2, 3].map((i) => (
                      <View
                        key={i}
                        style={[
                          s.strengthBar,
                          { backgroundColor: i < strength ? strengthColor : colors.line },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={s.strengthLabel}>{strengthLabel}</Text>
                </View>
              )}
            </Field>

            {step === "signup" && (
              <>
                <Field
                  label="Confirm password"
                  icon="lock-outline"
                  border={borderFor("pw2")}
                  error={errors.pw2}
                  value={pw2}
                  onChangeText={setPw2}
                  onFocus={() => setFocus("pw2")}
                  onBlur={() => setFocus(null)}
                  placeholder="Re-enter password"
                  secureTextEntry={!showPw2}
                  onToggleSecure={() => setShowPw2((v) => !v)}
                  autoCapitalize="none"
                  textContentType="newPassword"
                  editable={!pending}
                />
                <View style={{ gap: 6 }}>
                  <Pressable
                    style={s.checkRow}
                    onPress={() => setAgree((v) => !v)}
                    disabled={pending}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: agree }}
                  >
                    <Checkbox on={agree} accent={accent} error={!!errors.agree} />
                    <Text style={s.checkText}>
                      I agree to the{" "}
                      <Text style={s.checkLink} onPress={() => router.push("/privacy")}>
                        Privacy Policy
                      </Text>
                    </Text>
                  </Pressable>
                  {errors.agree && <Text style={s.errorText}>{errors.agree}</Text>}
                </View>
              </>
            )}

            {step === "login" && (
              <View style={s.loginRow}>
                <Pressable
                  style={s.checkRow}
                  onPress={() => setKeep((v) => !v)}
                  disabled={pending}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: keep }}
                >
                  <Checkbox on={keep} accent={accent} />
                  <Text style={s.checkText}>Keep me logged in</Text>
                </Pressable>
                <Pressable
                  onPress={() => showToast("Password reset is coming soon.")}
                  hitSlop={8}
                >
                  <Text style={s.forgot}>Forgot password?</Text>
                </Pressable>
              </View>
            )}

            {serverError && <Text style={s.serverError}>{serverError}</Text>}

            <Pressable
              style={[s.primaryBtn, { backgroundColor: accent }, pending && { opacity: 0.6 }]}
              disabled={pending}
              onPress={() => void submit()}
            >
              {pending ? (
                <View style={s.pendingRow}>
                  <ActivityIndicator color={colors.white} size="small" />
                  <Text style={s.primaryBtnText}>
                    {step === "signup" ? "Creating account…" : "Logging in…"}
                  </Text>
                </View>
              ) : (
                <Text style={s.primaryBtnText}>
                  {step === "signup" ? "Create account" : "Log in"}
                </Text>
              )}
            </Pressable>

            <View style={s.swapRow}>
              <Text style={s.swapText}>
                {step === "signup" ? "Already have an account?" : "Don't have an account?"}
              </Text>
              <Pressable
                onPress={() => go(step === "signup" ? "login" : "signup")}
                disabled={pending}
                hitSlop={8}
              >
                <Text style={[s.swapLink, { color: accent }]}>
                  {step === "signup" ? "Log in" : "Sign up"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {step === "done" && (
          <View style={s.done}>
            <View style={s.doneBody}>
              <View style={[s.doneHalo, { backgroundColor: greenSoft }]}>
                <View style={[s.doneCircle, { backgroundColor: green }]}>
                  <MaterialIcons name="check" size={48} color={colors.white} />
                </View>
              </View>
              <Text style={s.doneTitle}>You&apos;re all set, {firstName}</Text>
              <Text style={s.doneCopy}>
                {seller
                  ? "Your business profile is next. We will walk you through listing your first service."
                  : "Start discovering salons, spas, barbers and more near you."}
              </Text>
            </View>
            <Pressable
              style={[s.primaryBtn, { backgroundColor: accent }]}
              onPress={() => (seller ? router.replace("/merchant/onboard/step1") : close())}
            >
              <Text style={s.primaryBtnText}>
                {seller ? "Set up my business" : "Start exploring"}
              </Text>
            </Pressable>
            {seller && (
              <Pressable style={s.laterBtn} onPress={close} hitSlop={6}>
                <Text style={s.laterText}>I&apos;ll do this later</Text>
              </Pressable>
            )}
          </View>
        )}

        {toast && (
          <View style={s.toast} pointerEvents="none">
            <MaterialIcons name="info-outline" size={20} color={colors.surface} />
            <Text style={s.toastText}>{toast}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  icon,
  border,
  error,
  onToggleSecure,
  children,
  ...input
}: TextInputProps & {
  label: string;
  icon: IconName;
  border: string;
  error?: string;
  // Present on password fields: shows the eye toggle.
  onToggleSecure?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, { borderColor: border }, onToggleSecure && { paddingRight: 8 }]}>
        <MaterialIcons name={icon} size={20} color={colors.inkMuted} />
        <TextInput style={s.input} placeholderTextColor="#9A8F88" {...input} />
        {onToggleSecure && (
          <Pressable
            style={s.eyeBtn}
            onPress={onToggleSecure}
            accessibilityLabel={input.secureTextEntry ? "Show password" : "Hide password"}
          >
            <MaterialIcons
              name={input.secureTextEntry ? "visibility" : "visibility-off"}
              size={20}
              color={colors.inkMuted}
            />
          </Pressable>
        )}
      </View>
      {children}
      {error && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

function Checkbox({ on, accent, error }: { on: boolean; accent: string; error?: boolean }) {
  return (
    <View
      style={[
        s.checkbox,
        on && { backgroundColor: accent, borderColor: accent },
        error && !on && { borderColor: ERROR },
      ]}
    >
      {on && <MaterialIcons name="check" size={16} color={colors.white} />}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },

  // Welcome
  welcome: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 20 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12 },
  brand: { flex: 1, fontFamily: mf.extrabold, fontSize: 19, color: colors.ink, letterSpacing: -0.2 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BACK_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { flex: 1, minHeight: 0, borderRadius: 28, backgroundColor: colors.sand },

  title: { fontFamily: mf.extrabold, fontSize: 30, lineHeight: 35, color: colors.ink, letterSpacing: -0.6 },
  lead: { fontFamily: mf.medium, fontSize: 15, lineHeight: 22, color: colors.inkMuted },

  primaryBtn: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontFamily: mf.bold, fontSize: 16, color: colors.white },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  outlineBtn: {
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: { fontFamily: mf.bold, fontSize: 16, color: colors.ink },

  // Forms
  form: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 4, paddingBottom: 28, gap: 18 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BACK_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { gap: 8 },
  label: { fontFamily: mf.bold, fontSize: 14, color: colors.ink },
  typeRow: { flexDirection: "row", gap: 10 },
  typeCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    gap: 3,
  },
  typeTitle: { fontFamily: mf.bold, fontSize: 14, color: colors.ink },
  typeCopy: { fontFamily: mf.medium, fontSize: 12, lineHeight: 16, color: colors.inkMuted },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 54,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderRadius: 18,
  },
  input: { flex: 1, minWidth: 0, fontFamily: mf.medium, fontSize: 15, color: colors.ink, padding: 0 },
  eyeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  errorText: { fontFamily: mf.semibold, fontSize: 12.5, lineHeight: 16, color: ERROR },
  serverError: {
    fontFamily: mf.semibold,
    fontSize: 13.5,
    lineHeight: 19,
    color: ERROR,
    backgroundColor: "#FDECEA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: "hidden",
  },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  strengthBars: { flex: 1, flexDirection: "row", gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: {
    fontFamily: mf.semibold,
    fontSize: 12,
    color: colors.inkMuted,
    minWidth: 56,
    textAlign: "right",
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: BORDER_STRONG,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { fontFamily: mf.medium, fontSize: 13.5, color: colors.inkMuted, flexShrink: 1 },
  checkLink: { fontFamily: mf.bold, color: colors.ink },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  forgot: { fontFamily: mf.bold, fontSize: 13.5, color: colors.ink },
  swapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 4,
  },
  swapText: { fontFamily: mf.medium, fontSize: 14, color: colors.inkMuted },
  swapLink: { fontFamily: mf.bold, fontSize: 14 },

  // Done
  done: { flex: 1, paddingHorizontal: 24, paddingTop: 4, paddingBottom: 20, gap: 12 },
  doneBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  doneHalo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  doneCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    fontFamily: mf.extrabold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.ink,
    letterSpacing: -0.5,
    textAlign: "center",
    marginTop: 10,
  },
  doneCopy: {
    fontFamily: mf.medium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted,
    textAlign: "center",
    maxWidth: 290,
  },
  laterBtn: { alignSelf: "center", paddingVertical: 8 },
  laterText: { fontFamily: mf.bold, fontSize: 14, color: colors.inkMuted },

  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toastText: { flex: 1, fontFamily: mf.semibold, fontSize: 14, lineHeight: 19, color: colors.surface },
});
