import { AUTH_API_BASE_URL } from "@/config/env";

export type PreferredTime = "morning" | "afternoon" | "evening" | "flexible";

export type ConsumerBookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type ConsumerBooking = {
  id: string;
  businessId: string;
  businessName: string;
  serviceId: string | null;
  serviceName: string;
  price: number;
  date: string; // YYYY-MM-DD
  time: string; // "HH:MM" 24h — a placeholder start until the business confirms
  preferredTime: PreferredTime | null;
  durationMinutes: number;
  status: ConsumerBookingStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ConsumerBookingInput = {
  businessId: string;
  // Every service the consumer picked — each becomes its own booking.
  serviceIds: string[];
  customerName: string;
  customerPhone: string;
  date: string;
  preferredTime: PreferredTime;
  notes?: string;
};

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

// Booking requires a signed-in consumer — the booking is linked to their
// account, which is what puts it under Activity and lets them cancel it.
export function createBooking(token: string, input: ConsumerBookingInput) {
  return request<{ ok: true; bookings: ConsumerBooking[] }>("/api/consumer/bookings", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function fetchMyBookings(token: string) {
  return request<{ bookings: ConsumerBooking[] }>("/api/consumer/bookings", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function cancelMyBooking(token: string, bookingId: string) {
  return request<{ ok: true; booking: ConsumerBooking }>(
    `/api/consumer/bookings/${bookingId}/cancel`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}
