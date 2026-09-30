import { AUTH_API_BASE_URL } from "@/config/env";

export type AppNotification = {
  id: string;
  // booking_confirmed | booking_declined | booking_rescheduled |
  // booking_completed | business_approved | business_changes_requested
  type: string;
  title: string;
  body: string;
  bookingId: string | null;
  businessId: string | null;
  read: boolean;
  createdAt: string; // "YYYY-MM-DD HH:MM:SS.mmm", UTC
};

type ApiErrorPayload = { message?: string; error?: string };

async function request<T>(path: string, token: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    method,
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json().catch(() => null)) as (T & ApiErrorPayload) | null;
  if (!response.ok) {
    throw new Error(payload?.message ?? "We couldn't load your notifications. Please try again.");
  }
  return payload as T;
}

export function fetchNotifications(token: string) {
  return request<{ notifications: AppNotification[]; unreadCount: number }>(
    "/api/consumer/notifications",
    token,
  );
}

export function markNotificationsRead(token: string) {
  return request<{ ok: true }>("/api/consumer/notifications/read", token, "POST");
}
