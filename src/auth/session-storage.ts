/**
 * Where the signed-in session (the consumer and merchant bearer tokens)
 * is kept on the device.
 *
 * It belongs in the platform's encrypted store — Android Keystore / iOS
 * Keychain, via expo-secure-store — not AsyncStorage, which is a plain
 * file other software on a rooted or backed-up device can read.
 *
 * expo-secure-store is a native module. A dev build made before it was
 * added doesn't contain it, and web has no equivalent, so this falls back
 * to AsyncStorage when the module is missing rather than crashing at
 * startup. Any build made after the dependency was added has it.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

type SecureStoreModule = typeof import("expo-secure-store");

let secureStore: SecureStoreModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("expo-secure-store") as SecureStoreModule;
  // The JS package can be present without the native half (old dev build,
  // web) — only trust it if the calls it needs actually exist.
  if (typeof mod.getItemAsync === "function") secureStore = mod;
} catch {
  secureStore = null;
}

// SecureStore keys allow only [A-Za-z0-9._-].
const SECURE_KEY = "kilipicks.auth.session.v2";
// Where earlier builds kept the session, unencrypted.
const LEGACY_KEY = "kilipicks.auth.session.v2";

async function secureAvailable() {
  if (!secureStore) return false;
  try {
    return await secureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function loadSession(): Promise<string | null> {
  if (!(await secureAvailable()) || !secureStore) {
    return AsyncStorage.getItem(LEGACY_KEY);
  }
  const stored = await secureStore.getItemAsync(SECURE_KEY);
  if (stored) return stored;

  // First launch on a build with secure storage: move the session across
  // and remove the unencrypted copy, so upgrading doesn't sign anyone out.
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (!legacy) return null;
  await secureStore.setItemAsync(SECURE_KEY, legacy);
  await AsyncStorage.removeItem(LEGACY_KEY);
  return legacy;
}

export async function saveSession(value: string) {
  if ((await secureAvailable()) && secureStore) {
    await secureStore.setItemAsync(SECURE_KEY, value);
    await AsyncStorage.removeItem(LEGACY_KEY);
    return;
  }
  await AsyncStorage.setItem(LEGACY_KEY, value);
}

export async function clearSession() {
  if ((await secureAvailable()) && secureStore) {
    await secureStore.deleteItemAsync(SECURE_KEY).catch(() => {});
  }
  await AsyncStorage.removeItem(LEGACY_KEY);
}
