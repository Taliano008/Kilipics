import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from "react";

// Phase Zero has no auth backend at all — no OTP delivery, no session
// tokens, no credential storage. This is UI-only scaffolding: every start*
// method below always resolves "unavailable". When a real provider exists,
// only this file changes — screens never branch on anything but `status`
// and the AuthResult each method returns.

export type AuthStatus = "signed_out" | "signed_in";

export type AuthUser = {
  id: string;
  phone?: string;
  email?: string;
  name?: string;
};

export type AuthResult =
  | { status: "unavailable"; message: string }
  | { status: "success" }
  | { status: "error"; message: string };

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  startPhoneAuth: (e164: string) => Promise<AuthResult>;
  startEmailAuth: () => Promise<AuthResult>;
  startGoogleAuth: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const COMING_SOON_MESSAGE =
  "Accounts are coming in a future KiliPicks release. Browsing and saving businesses already work without one.";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const value = useMemo<AuthState>(
    () => ({
      status: "signed_out",
      user: null,
      startPhoneAuth: async () => ({
        status: "unavailable",
        message: COMING_SOON_MESSAGE,
      }),
      startEmailAuth: async () => ({
        status: "unavailable",
        message: COMING_SOON_MESSAGE,
      }),
      startGoogleAuth: async () => ({
        status: "unavailable",
        message: COMING_SOON_MESSAGE,
      }),
      signOut: async () => {},
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
