import { AUTH_API_BASE_URL } from "@/config/env";

export type AccountType = "consumer" | "merchant";

export type ConsumerProfile = {
  id: string;
  fullName: string;
  email: string;
  photoUrl?: string | null;
};

export type MerchantProfile = {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "suspended";
  hasBusiness?: boolean;
  businessId?: string;
  onboardingStep?: number;
  onboardingSubmitted?: boolean;
};

// A linked merchant identity, never merged into the consumer's own record.
// `token` is present only when this call actually authenticated the
// merchant session (signup-with-merchant, a login whose password matched
// both identities, or becoming a seller) — its absence plus
// `needsMerchantSignIn` means a merchant identity exists but this call
// didn't have the right credentials to open its session.
export type MerchantSession =
  | { token: string; profile: MerchantProfile }
  | { profile: MerchantProfile; needsMerchantSignIn?: true }
  | null;

export type ConsumerSession = {
  token: string;
  profile: ConsumerProfile;
};

type ApiErrorPayload = { message?: string; error?: string; fields?: string[] };
type ApiError = Error & { code?: string; fields?: string[] };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    ...options,
    headers: { Accept: "application/json", ...options.headers },
  });
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (!response.ok) {
    const error = new Error(
      payload?.message ??
        (response.status === 409
          ? "An account already exists for this email."
          : "We couldn't complete that request. Please try again."),
    ) as ApiError;
    error.code = payload?.error;
    error.fields = payload?.fields;
    throw error;
  }
  return payload as T;
}

export function signUpWithEmail(input: {
  name: string;
  email: string;
  password: string;
  accountType: AccountType;
}) {
  return request<{ consumer: ConsumerSession; merchant: MerchantSession }>("/api/auth/consumer/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: input.name,
      email: input.email,
      password: input.password,
      accountType: input.accountType,
    }),
  });
}

export function signInWithEmail(input: { email: string; password: string }) {
  return request<{ consumer: ConsumerSession; merchant: MerchantSession }>("/api/auth/consumer/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getCurrentConsumer(consumerToken: string) {
  return request<{ consumer: ConsumerProfile; merchant: MerchantSession }>("/api/auth/consumer/me", {
    headers: { Authorization: `Bearer ${consumerToken}` },
  });
}

export function signOutConsumer(consumerToken: string) {
  return request<{ ok: true }>("/api/auth/consumer/signout", {
    method: "POST",
    headers: { Authorization: `Bearer ${consumerToken}` },
  });
}

// "Switch to seller" — creates a genuinely separate merchant identity linked
// to the signed-in consumer, with its own password. Never reuses the
// consumer's credential: this is a real second account, not a role flag.
export function becomeMerchant(consumerToken: string, input: { fullName: string; password: string }) {
  return request<{ merchant: MerchantSession }>("/api/auth/consumer/merchant", {
    method: "POST",
    headers: { Authorization: `Bearer ${consumerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// Standalone merchant sign-in, used when a linked merchant session couldn't
// be opened at consumer login time (see MerchantSession's needsMerchantSignIn).
export function signInMerchant(input: { email: string; password: string }) {
  return request<{ token: string; merchant: MerchantProfile }>("/api/auth/merchant/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function signOutMerchant(merchantToken: string) {
  return request<{ ok: true }>("/api/auth/merchant/signout", {
    method: "POST",
    headers: { Authorization: `Bearer ${merchantToken}` },
  });
}

// Separate from request<T>() on purpose: that helper always forces
// Content-Type: application/json, which would break multipart here — the
// runtime needs to set Content-Type itself (with the boundary) when the
// body is a FormData. Mirrors uploadMerchantPhoto in src/api/merchant.ts.
import * as FileSystem from "expo-file-system/legacy";

export async function uploadConsumerPhoto(
  consumerToken: string,
  photo: { uri: string; name: string; mimeType: string },
) {
  const uploadResponse = await FileSystem.uploadAsync(
    `${AUTH_API_BASE_URL}/api/consumer/media/photo`,
    photo.uri,
    {
      fieldName: "photo",
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      headers: { Authorization: `Bearer ${consumerToken}` },
      mimeType: photo.mimeType,
    },
  );

  let payload: ({ ok: true; consumer: ConsumerProfile } & ApiErrorPayload) | null = null;
  try {
    payload = JSON.parse(uploadResponse.body);
  } catch {
    // leave payload as null
  }

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    const error = new Error(
      payload?.message ?? "We couldn't upload that photo. Please try again.",
    ) as ApiError;
    error.code = payload?.error;
    throw error;
  }

  return payload as { ok: true; consumer: ConsumerProfile };
}
