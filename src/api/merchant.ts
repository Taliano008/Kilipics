import { AUTH_API_BASE_URL } from "@/config/env";
import type { PublicCatalogProvider, PublicCatalogService } from "@/types/catalog";

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
  subcategory?: string | null;
  email?: string | null;
  phone: string;
  area: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  locationType: "physical" | "mobile";
  travelRadius: number;
  radiusEnabled: boolean;
  serviceAreas: { radiusMiles: number; enabled: boolean }[];
  hours: string;
  activePreset: string;
  positioning: string;
  about: string;
  coverUrl?: string | null;
  galleryUrls: string[];
  onboardingStep: number;
  submittedAt?: string | null;
  publicationStatus: "draft" | "published" | "hidden" | "archived";
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
  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
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
import * as FileSystem from "expo-file-system";

export async function uploadMerchantPhoto(
  token: string,
  photo: { uri: string; name: string; mimeType: string },
  purpose?: "cover" | "gallery" | "look" | "service",
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

  const payload = (await JSON.parse(uploadResponse.body).catch(() => null)) as
    | ({ ok: true; url: string; merchantToken?: string | null } & ApiErrorPayload)
    | null;

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
