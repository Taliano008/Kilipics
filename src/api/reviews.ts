import { AUTH_API_BASE_URL } from "@/config/env";

export type Review = {
  id: string;
  businessId: string;
  rating: number; // 1–5
  body: string;
  authorName: string; // "Amara W." — never the full surname
  authorPhotoUrl: string | null;
  createdAt: string; // "YYYY-MM-DD HH:MM:SS.mmm", UTC
  updatedAt: string;
};

export type OwnReview = Review & { status: "published" | "hidden" };

export type ReviewSummary = { count: number; average: number | null };

type ApiErrorPayload = { message?: string; error?: string; fields?: string[] };
type ApiError = Error & { code?: string; fields?: string[] };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as (T & ApiErrorPayload) | null;
  if (!response.ok) {
    const error = new Error(
      payload?.message ?? "We couldn't complete that request. Please try again.",
    ) as ApiError;
    error.code = payload?.error;
    error.fields = payload?.fields;
    throw error;
  }
  return payload as T;
}

export function fetchBusinessReviews(businessId: string) {
  return request<{ reviews: Review[]; summary: ReviewSummary }>(
    `/api/public/businesses/${businessId}/reviews`,
  );
}

export function fetchOwnReview(token: string, businessId: string) {
  return request<{ review: OwnReview | null }>(`/api/consumer/businesses/${businessId}/review`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function saveReview(
  token: string,
  businessId: string,
  input: { rating: number; body: string },
) {
  return request<{ ok: true; review: OwnReview }>(`/api/consumer/businesses/${businessId}/review`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}
