import { describe, expect, it } from "vitest";

import { bookingCountsAsSale, bookingIsUpcoming } from "@/merchant/sales-rules";

// Thursday 15 October 2026, 14:30 local time.
const now = new Date(2026, 9, 15, 14, 30);

describe("bookingCountsAsSale", () => {
  it("counts completed bookings, even ones dated later", () => {
    expect(bookingCountsAsSale({ status: "completed", date: "2026-10-20", time: "10:00" }, now)).toBe(true);
  });

  it("counts a confirmed booking only once its time has passed", () => {
    expect(bookingCountsAsSale({ status: "confirmed", date: "2026-10-14", time: "18:00" }, now)).toBe(true);
    expect(bookingCountsAsSale({ status: "confirmed", date: "2026-10-15", time: "14:30" }, now)).toBe(true);
    expect(bookingCountsAsSale({ status: "confirmed", date: "2026-10-15", time: "15:00" }, now)).toBe(false);
    expect(bookingCountsAsSale({ status: "confirmed", date: "2026-10-17", time: "09:00" }, now)).toBe(false);
  });

  it("never counts pending or cancelled bookings", () => {
    expect(bookingCountsAsSale({ status: "pending", date: "2026-10-10", time: "09:00" }, now)).toBe(false);
    expect(bookingCountsAsSale({ status: "cancelled", date: "2026-10-10", time: "09:00" }, now)).toBe(false);
  });
});

describe("bookingIsUpcoming", () => {
  it("is true only for confirmed bookings still ahead", () => {
    expect(bookingIsUpcoming({ status: "confirmed", date: "2026-10-17", time: "09:00" }, now)).toBe(true);
    expect(bookingIsUpcoming({ status: "confirmed", date: "2026-10-14", time: "09:00" }, now)).toBe(false);
    expect(bookingIsUpcoming({ status: "pending", date: "2026-10-17", time: "09:00" }, now)).toBe(false);
  });
});
