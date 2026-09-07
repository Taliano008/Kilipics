import { describe, expect, it } from "vitest";

import { categoryLabel } from "@/utils/categories";
import { compareVersions } from "@/utils/version";

describe("compareVersions", () => {
  it("compares uneven dotted version segments numerically", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.9.9", "1.0.0")).toBe(-1);
  });
});

describe("categoryLabel", () => {
  it("uses curated labels and humanizes unknown category ids", () => {
    expect(categoryLabel("spa")).toBe("Spa & Massage");
    expect(categoryLabel("body-care_special")).toBe("Body Care Special");
  });
});
