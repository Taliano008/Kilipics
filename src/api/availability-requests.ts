import { AUTH_API_BASE_URL } from "@/config/env";

export type AvailabilityRequestInput = {
  businessId: string;
  serviceId?: string;
  consumerName: string;
  whatsappNumber: string;
  preferredDate: string;
  preferredTime: "morning" | "afternoon" | "evening" | "flexible";
  notes?: string;
};

export type AvailabilityRequest = AvailabilityRequestInput & {
  id: string;
  status: "new" | "contacted" | "closed";
  createdAt: string;
  updatedAt: string;
};

type ApiErrorPayload = { message?: string; error?: string; fields?: string[] };
type ApiError = Error & { code?: string; fields?: string[] };

// No auth header — a consumer isn't required to be signed in to check
// availability, mirroring the booking screen's own access rules.
export async function submitAvailabilityRequest(input: AvailabilityRequestInput) {
  const response = await fetch(`${AUTH_API_BASE_URL}/api/public/availability-requests`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | ({ ok: true; request: AvailabilityRequest } & ApiErrorPayload)
    | null;

  if (!response.ok) {
    const error = new Error(
      payload?.message ?? "We couldn't send that request. Please try again.",
    ) as ApiError;
    error.code = payload?.error;
    error.fields = payload?.fields;
    throw error;
  }

  return payload as { ok: true; request: AvailabilityRequest };
}
