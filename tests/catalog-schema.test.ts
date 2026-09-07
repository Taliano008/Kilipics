import { describe, expect, it } from "vitest";

import { publicCatalogSnapshotSchema } from "@/schemas/catalog";

import { makeSnapshot } from "./fixtures/catalog";

describe("publicCatalogSnapshotSchema", () => {
  it("accepts a valid public catalog snapshot", () => {
    expect(publicCatalogSnapshotSchema.safeParse(makeSnapshot()).success).toBe(true);
  });

  it("rejects providers whose Nairobi-only location contract is violated", () => {
    const provider = makeSnapshot().providers[0];
    const result = publicCatalogSnapshotSchema.safeParse(
      makeSnapshot({
        providers: [
          {
            ...provider,
            location: {
              ...provider.location,
              city: "Mombasa" as unknown as typeof provider.location.city,
            },
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
  });
});
