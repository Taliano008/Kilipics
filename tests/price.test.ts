import { describe, expect, it } from "vitest";

import { formatServicePrice } from "@/utils/price";

describe("formatServicePrice", () => {
  it("formats each price type the way service photos are captioned", () => {
    expect(formatServicePrice({ price: 4500, priceType: "fixed" })).toBe("KES 4,500");
    expect(formatServicePrice({ price: 1800, priceType: "from" })).toBe("From KES 1,800");
    expect(formatServicePrice({ price: 1000, maximumPrice: 2500, priceType: "range" })).toBe(
      "KES 1,000 – 2,500",
    );
    expect(formatServicePrice({ price: 0, priceType: "contact_for_price" })).toBe("");
  });
});
