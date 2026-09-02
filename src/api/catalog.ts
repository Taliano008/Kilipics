import { API_BASE_URL } from "@/config/env";
import type { PublicCatalogSnapshot } from "@/types/catalog";

export async function fetchCatalog(signal?: AbortSignal): Promise<PublicCatalogSnapshot> {
  const response = await fetch(`${API_BASE_URL}/api/public/catalog`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  const payload = (await response.json()) as PublicCatalogSnapshot;
  if (!Array.isArray(payload.providers)) throw new Error("Catalog response is invalid");
  return payload;
}
