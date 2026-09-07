import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  becomeMerchant as requestBecomeMerchant,
  getCurrentConsumer,
  signInWithEmail as requestEmailSignIn,
  signOutConsumer,
  signOutMerchant,
  signUpWithEmail as requestEmailSignUp,
  type AccountType,
  type ConsumerProfile,
  type MerchantProfile,
} from "@/api/auth";
import { report } from "@/observability/report";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SESSION_KEY = "kilipicks.auth.session.v2";

export type AuthStatus = "loading" | "signed_out" | "signed_in";
export type AuthUser = ConsumerProfile;

export type EmailSignUpInput = {
  name: string;
  email: string;
  password: string;
  accountType: AccountType;
};

// Two independent sessions, never one shared row: a consumer token/profile
// (always present once signed in) and an optional merchant token/profile
// (present only once a linked merchant identity has actually been
// authenticated in this session — see MerchantSession in src/api/auth.ts).
type StoredSession = {
  consumerToken: string;
  consumer: ConsumerProfile;
  merchantToken: string | null;
  merchant: MerchantProfile | null;
};

type AuthState = {
  status: AuthStatus;
  user: ConsumerProfile | null;
  merchant: MerchantProfile | null;
  merchantLinked: boolean;
  merchantNeedsSignIn: boolean;
  signUpWithEmail: (input: EmailSignUpInput) => Promise<void>;
  signInWithEmail: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  becomeMerchant: (input: { fullName: string; password: string }) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [consumerToken, setConsumerToken] = useState<string | null>(null);
  const [consumer, setConsumer] = useState<ConsumerProfile | null>(null);
  const [merchantToken, setMerchantToken] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [merchantNeedsSignIn, setMerchantNeedsSignIn] = useState(false);

  const persist = useCallback(async (session: StoredSession) => {
    setConsumerToken(session.consumerToken);
    setConsumer(session.consumer);
    setMerchantToken(session.merchantToken);
    setMerchant(session.merchant);
    setStatus("signed_in");
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, []);

  const clear = useCallback(async () => {
    setStatus("signed_out");
    setConsumerToken(null);
    setConsumer(null);
    setMerchantToken(null);
    setMerchant(null);
    setMerchantNeedsSignIn(false);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(SESSION_KEY);
        if (!stored) return;
        const session = JSON.parse(stored) as StoredSession;
        const response = await getCurrentConsumer(session.consumerToken);
        if (!active) return;
        // /me reports only whether a merchant is linked, never a token —
        // carry forward whatever merchant session this device already had.
        const linkedMerchant = response.merchant;
        await persist({
          consumerToken: session.consumerToken,
          consumer: response.consumer,
          merchantToken: linkedMerchant ? session.merchantToken : null,
          merchant: linkedMerchant
            ? (linkedMerchant.profile as MerchantProfile)
            : null,
        });
      } catch {
        await AsyncStorage.removeItem(SESSION_KEY);
      } finally {
        if (active) setStatus((current) => (current === "signed_in" ? current : "signed_out"));
      }
    })();
    return () => {
      active = false;
    };
  }, [persist]);

  const signUpWithEmail = useCallback(
    async (input: EmailSignUpInput) => {
      const response = await requestEmailSignUp(input);
      setMerchantNeedsSignIn(false);
      await persist({
        consumerToken: response.consumer.token,
        consumer: response.consumer.profile,
        merchantToken: response.merchant && "token" in response.merchant ? response.merchant.token : null,
        merchant: response.merchant?.profile ?? null,
      });
    },
    [persist],
  );

  const signInWithEmail = useCallback(
    async (input: { email: string; password: string }) => {
      const response = await requestEmailSignIn(input);
      const hasMerchantToken = Boolean(response.merchant && "token" in response.merchant);
      setMerchantNeedsSignIn(Boolean(response.merchant && !hasMerchantToken));
      await persist({
        consumerToken: response.consumer.token,
        consumer: response.consumer.profile,
        merchantToken: hasMerchantToken ? (response.merchant as { token: string }).token : null,
        merchant: response.merchant?.profile ?? null,
      });
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    const activeConsumerToken = consumerToken;
    const activeMerchantToken = merchantToken;
    await clear();
    if (activeConsumerToken) {
      void signOutConsumer(activeConsumerToken).catch((reason) =>
        report(reason, { scope: "auth_sign_out_consumer" }, "warning"),
      );
    }
    if (activeMerchantToken) {
      void signOutMerchant(activeMerchantToken).catch((reason) =>
        report(reason, { scope: "auth_sign_out_merchant" }, "warning"),
      );
    }
  }, [clear, consumerToken, merchantToken]);

  const becomeMerchant = useCallback(
    async (input: { fullName: string; password: string }) => {
      if (!consumerToken || !consumer) throw new Error("Sign in before adding a business account.");
      const response = await requestBecomeMerchant(consumerToken, input);
      if (!response.merchant || !("token" in response.merchant)) {
        throw new Error("We couldn't create your business account. Please try again.");
      }
      setMerchantNeedsSignIn(false);
      await persist({
        consumerToken,
        consumer,
        merchantToken: response.merchant.token,
        merchant: response.merchant.profile,
      });
    },
    [consumer, consumerToken, persist],
  );

  const value = useMemo(
    () => ({
      status,
      user: consumer,
      merchant,
      merchantLinked: merchant != null || merchantNeedsSignIn,
      merchantNeedsSignIn,
      signUpWithEmail,
      signInWithEmail,
      signOut,
      becomeMerchant,
    }),
    [status, consumer, merchant, merchantNeedsSignIn, signUpWithEmail, signInWithEmail, signOut, becomeMerchant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
