import { AUTH_API_BASE_URL } from "@/config/env";
import type {
  GalleryCaption,
  PublicCatalogProvider,
  PublicCatalogService,
} from "@/types/catalog";

export type DaySchedule = {
  name: string;
  open: boolean;
  from: string;
  to: string;
};

export type GalleryPhoto = {
  uri: string;
  label: string;
};

export type MerchantBusiness = {
  id: string;
  merchantId: string;
  slug: string;
  name: string;
  industry: "beauty" | "wellness";
  categoryId: string;
  categoryIds?: string[];
  subcategory?: string | null;
  email?: string | null;
  phone: string;
  area: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  // pin = placed by the merchant; address = looked up from the street
  // address (approximate); none = city-centre placeholder.
  locationPrecision?: "pin" | "address" | "none";
  locationType: "physical" | "mobile";
  travelRadius: number;
  radiusEnabled: boolean;
  serviceAreas: { radiusMiles: number; enabled: boolean }[];
  hours: string;
  activePreset: string;
  positioning: string;
  about: string;
  coverUrl?: string | null;
  logoUrl?: string | null;
  galleryUrls: string[];
  // Optional title/price per gallery photo, keyed by its URL in galleryUrls.
  galleryCaptions?: Record<string, GalleryCaption>;
  onboardingStep: number;
  submittedAt?: string | null;
  publicationStatus: "draft" | "published" | "hidden" | "archived";
  // Where the KiliPicks team's review of the listing stands, and their
  // message to the merchant when they've asked for changes.
  reviewStatus?: "not_submitted" | "awaiting_review" | "changes_requested" | "approved";
  reviewNote?: string;
  limitedListing: boolean;
  bookingEnabled: boolean;
  verified: boolean;
  rating: number | null;
  verifiedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Step1Input = {
  name: string;
  // Primary first. `category` is the primary alone, kept for backends that
  // predate multi-category support.
  categories: string[];
  category: string;
  description: string;
  phone: string;
  email: string;
};

export type Step2Input = {
  address: string;
  area?: string;
  locationType: "physical" | "mobile";
  radius: number;
  radiusEnabled: boolean;
  // The store's map pin; omitted until the merchant places one.
  latitude?: number;
  longitude?: number;
};

export type Step3Input = {
  photos: GalleryPhoto[];
  activePreset: string;
  days: DaySchedule[];
  hoursText?: string;
};

export type MerchantService = {
  id: string;
  providerId: string;
  categoryId: string;
  industry: "beauty" | "wellness";
  name: string;
  description: string;
  price: number;
  maximumPrice?: number;
  priceType: "fixed" | "from" | "range" | "contact_for_price";
  durationMinutes: number;
  bookingEnabled: boolean;
  active: boolean;
  sortOrder: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceInput = {
  name: string;
  categoryId: string;
  description?: string;
  priceType: MerchantService["priceType"];
  price: number;
  maximumPrice?: number;
  durationMinutes: number;
  active: boolean;
  bookingEnabled: boolean;
  imageUrl?: string | null;
};

type ApiErrorPayload = { message?: string; error?: string; fields?: string[] };
type ApiError = Error & { code?: string; fields?: string[] };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseHeaders: Record<string, string> = {
    Accept: "application/json",
  };
  
  if (options.body) {
    baseHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...baseHeaders,
      ...options.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;

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

// Separate from request<T>() on purpose: that helper always forces
// Content-Type: application/json, which would break multipart here — the
// runtime needs to set Content-Type itself (with the boundary) when the
// body is a FormData.
import * as FileSystem from "expo-file-system/legacy";

export async function uploadMerchantPhoto(
  token: string,
  photo: { uri: string; name: string; mimeType: string },
  purpose?: "cover" | "gallery" | "look" | "service" | "logo",
) {
  const uploadResponse = await FileSystem.uploadAsync(
    `${AUTH_API_BASE_URL}/api/merchant/media/photos`,
    photo.uri,
    {
      fieldName: "photo",
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      parameters: purpose ? { purpose } : undefined,
      mimeType: photo.mimeType,
    }
  );

  let payload = null;
  try {
    payload = JSON.parse(uploadResponse.body) as 
      | ({ ok: true; url: string; merchantToken?: string | null } & ApiErrorPayload);
  } catch (e) {
    // leave payload as null
  }

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    const error = new Error(
      payload?.message ?? "We couldn't upload that photo. Please try again.",
    ) as ApiError;
    error.code = payload?.error;
    throw error;
  }
  
  return payload as { ok: true; url: string; merchantToken?: string | null };
}

export function fetchMerchantBusiness(token: string) {
  return request<{ business: MerchantBusiness | null; merchantToken?: string | null }>(
    "/api/merchant/business",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

// Same PublicCatalogProvider/Service shape the consumer catalog uses, but
// sourced live from the merchant's own business regardless of
// publicationStatus — lets a merchant preview a still-in-review listing.
export function fetchMerchantBusinessPreview(token: string) {
  return request<{ provider: PublicCatalogProvider; services: PublicCatalogService[] }>(
    "/api/merchant/business/preview",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export function saveMerchantStep1(token: string, input: Step1Input) {
  return request<{ ok: boolean; business: MerchantBusiness; merchantToken?: string | null }>(
    "/api/merchant/business/step1",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    },
  );
}

export function saveMerchantStep2(token: string, input: Step2Input) {
  return request<{ ok: boolean; business: MerchantBusiness; merchantToken?: string | null }>(
    "/api/merchant/business/step2",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    },
  );
}

export function saveMerchantStep3(token: string, input: Step3Input) {
  return request<{ ok: boolean; business: MerchantBusiness; merchantToken?: string | null }>(
    "/api/merchant/business/step3",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    },
  );
}

export function submitMerchantOnboarding(token: string) {
  return request<{
    ok: boolean;
    business: MerchantBusiness;
    status: string;
    submittedAt: string;
    merchantToken?: string | null;
  }>("/api/merchant/business/submit", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateMerchantBusiness(
  token: string,
  input: Partial<MerchantBusiness>,
) {
  return request<{ ok: boolean; business: MerchantBusiness; merchantToken?: string | null }>(
    "/api/merchant/business",
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    },
  );
}

export function fetchMerchantServices(token: string) {
  return request<{ services: MerchantService[]; merchantToken?: string | null }>(
    "/api/merchant/services",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export function createMerchantService(token: string, input: ServiceInput) {
  return request<{ ok: boolean; service: MerchantService; merchantToken?: string | null }>(
    "/api/merchant/services",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    },
  );
}

export function updateMerchantService(
  token: string,
  serviceId: string,
  input: Partial<ServiceInput>,
) {
  return request<{ ok: boolean; service: MerchantService; merchantToken?: string | null }>(
    `/api/merchant/services/${serviceId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    },
  );
}

export function archiveMerchantService(token: string, serviceId: string) {
  return request<{ ok: boolean; service: MerchantService; merchantToken?: string | null }>(
    `/api/merchant/services/${serviceId}/archive`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export function duplicateMerchantService(token: string, serviceId: string) {
  return request<{ ok: boolean; service: MerchantService; merchantToken?: string | null }>(
    `/api/merchant/services/${serviceId}/duplicate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export function deleteMerchantService(token: string, serviceId: string) {
  return request<{ ok: boolean; merchantToken?: string | null }>(
    `/api/merchant/services/${serviceId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type MerchantBooking = {
  id: string;
  businessId: string;
  serviceId: string | null;
  serviceName: string;
  price: number;
  customerName: string;
  customerPhone: string;
  date: string; // YYYY-MM-DD
  time: string; // "HH:MM" 24h
  durationMinutes: number;
  status: BookingStatus;
  notes: string;
  source: "manual" | "app";
  // Consumer app bookings only: the time of day the customer asked for.
  // `time` is a placeholder start for it until the slot is agreed.
  preferredTime: "morning" | "afternoon" | "evening" | "flexible" | null;
  // Set on cancelled bookings. A "customer" cancellation is final, and is
  // shown as an alert until the merchant dismisses it (cancelAcknowledged).
  cancelledBy: "customer" | "merchant" | null;
  cancelAcknowledged: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BookingInput = {
  customerName: string;
  customerPhone: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  date: string;
  time: string;
  durationMinutes?: number;
  notes?: string;
};

export function fetchMerchantBookings(
  token: string,
  filters: { date?: string; from?: string; to?: string; status?: BookingStatus } = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return request<{ bookings: MerchantBooking[]; merchantToken?: string | null }>(
    `/api/merchant/bookings${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export function createMerchantBooking(token: string, input: BookingInput) {
  return request<{ ok: boolean; booking: MerchantBooking; merchantToken?: string | null }>(
    "/api/merchant/bookings",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    },
  );
}

// `time` ("HH:MM") sets the appointment time when accepting; `declineReason`
// is passed on to the customer when declining.
export type BookingStatusExtras = { time?: string; declineReason?: string };

export function updateMerchantBookingStatus(
  token: string,
  bookingId: string,
  status: BookingStatus,
  extras: BookingStatusExtras = {},
) {
  return request<{ ok: boolean; booking: MerchantBooking; merchantToken?: string | null }>(
    `/api/merchant/bookings/${bookingId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, ...extras }),
    },
  );
}

export function acknowledgeBookingCancellation(token: string, bookingId: string) {
  return request<{ ok: boolean; booking: MerchantBooking; merchantToken?: string | null }>(
    `/api/merchant/bookings/${bookingId}/acknowledge-cancellation`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export function reorderMerchantServices(token: string, orderedIds: string[]) {
  return request<{ ok: boolean; services: MerchantService[]; merchantToken?: string | null }>(
    "/api/merchant/services/reorder",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderedIds }),
    },
  );
}

export type SalesTransactionType = "income" | "expense";

// A transaction the merchant typed in on the Sales tab. Sales that come
// from bookings aren't stored as these — the app derives them from the
// bookings list.
export type SalesTransaction = {
  id: string;
  type: SalesTransactionType;
  amount: number;
  description: string;
  method: string;
  date: string; // YYYY-MM-DD, the merchant's local day
  createdAt: string; // "YYYY-MM-DD HH:MM:SS.mmm", UTC
};

export type SalesGoals = { daily: number; weekly: number; monthly: number };

export type SalesTransactionInput = {
  type: SalesTransactionType;
  amount: number;
  description: string;
  method?: string;
  date: string;
};

type SalesPayload = {
  transactions: SalesTransaction[];
  goals: SalesGoals;
  merchantToken?: string | null;
};

export function fetchMerchantSales(token: string) {
  return request<SalesPayload>("/api/merchant/sales", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createSalesTransaction(token: string, input: SalesTransactionInput) {
  return request<{ ok: boolean; transaction: SalesTransaction; merchantToken?: string | null }>(
    "/api/merchant/sales/transactions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    },
  );
}

export function deleteSalesTransaction(token: string, id: string) {
  return request<{ ok: boolean; merchantToken?: string | null }>(
    `/api/merchant/sales/transactions/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
}

export function saveSalesGoals(token: string, goals: Partial<SalesGoals>) {
  return request<{ ok: boolean; goals: SalesGoals; merchantToken?: string | null }>(
    "/api/merchant/sales/goals",
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(goals),
    },
  );
}

// One-time upload of the old device-only sales store. clientRef is the id a
// row had on the device, so a retried upload doesn't duplicate it.
export function importLocalSales(
  token: string,
  input: {
    transactions: (SalesTransactionInput & { clientRef: string; createdAt?: string })[];
    goals?: SalesGoals;
  },
) {
  return request<SalesPayload & { ok: boolean; imported: number }>("/api/merchant/sales/import", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export type StoreVisitsRange = "today" | "week" | "month";

// Counts for the Profile tab's Store visits card. Anonymous: no visitor
// identities are ever returned.
export type StoreVisits = {
  range: StoreVisitsRange;
  visits: number;
  people: number;
  contacted: number;
  bookTaps: number;
  saves: number;
  previousVisits: number;
  // Null until the previous period has visits to compare against.
  comparison: { delta: number; percent: number } | null;
  series: { label: string; value: number }[];
  currentIndex: number;
  lifetimeVisits: number;
  merchantToken?: string | null;
};

export function fetchStoreVisits(
  token: string,
  params: { range: StoreVisitsRange; tzOffset: number; exclude?: string },
) {
  const qs = new URLSearchParams({
    range: params.range,
    tzOffset: String(params.tzOffset),
    ...(params.exclude ? { exclude: params.exclude } : {}),
  });
  return request<StoreVisits>(`/api/merchant/insights/visits?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
