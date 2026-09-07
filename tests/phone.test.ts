import { describe, expect, it } from "vitest";

import { normalizeKenyanPhone } from "@/utils/phone";

describe("normalizeKenyanPhone", () => {
  it.each([
    ["0712 345 678", "+254712345678"],
    ["+254 712 345 678", "+254712345678"],
    ["712345678", "+254712345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each([undefined, null, "", "071234567", "25471234567", "not a phone"])(
    "rejects invalid input %s",
    (input) => {
      expect(normalizeKenyanPhone(input)).toBeNull();
    },
  );
});
