import { API_BASE_URL } from "@/config/env";
import { report } from "@/observability/report";
import { publicCatalogSnapshotSchema } from "@/schemas/catalog";
import type { PublicCatalogSnapshot } from "@/types/catalog";

export class CatalogSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogSchemaError";
  }
}

export async function fetchCatalog(signal?: AbortSignal): Promise<PublicCatalogSnapshot> {
  const response = await fetch(`${API_BASE_URL}/api/public/catalog`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  const json = await response.json();
  const result = publicCatalogSnapshotSchema.safeParse(json);
  if (!result.success) {
    report(result.error, {
      scope: "catalog_fetch",
      issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    throw new CatalogSchemaError("Catalog response did not match the expected shape");
  }
  return result.data;
}
