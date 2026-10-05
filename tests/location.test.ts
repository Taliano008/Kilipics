import { describe, expect, it } from "vitest";

import {
  NAIROBI_CENTER,
  directionsUrl,
  hasPinnedLocation,
  mapLocation,
  mapsSearchUrl,
} from "@/utils/location";

describe("hasPinnedLocation", () => {
  it("treats the backend's Nairobi default as no pin", () => {
    expect(hasPinnedLocation(NAIROBI_CENTER)).toBe(false);
  });

  it("rejects missing, zero and non-finite coordinates", () => {
    expect(hasPinnedLocation(null)).toBe(false);
    expect(hasPinnedLocation({ latitude: 0, longitude: 0 })).toBe(false);
    expect(hasPinnedLocation({ latitude: Number.NaN, longitude: 36.8 })).toBe(false);
    expect(hasPinnedLocation({ latitude: -1.29 })).toBe(false);
  });

  it("accepts a real pin", () => {
    expect(hasPinnedLocation({ latitude: -1.2898, longitude: 36.7869 })).toBe(true);
  });
});

describe("directionsUrl", () => {
  it("builds a Google Maps directions link to the pin", () => {
    expect(directionsUrl({ latitude: -1.2898, longitude: 36.7869 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=-1.2898,36.7869",
    );
  });
});

describe("mapsSearchUrl", () => {
  it("encodes the address as a Google Maps search", () => {
    expect(mapsSearchUrl("Yaya Centre, Kilimani, Nairobi")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Yaya%20Centre%2C%20Kilimani%2C%20Nairobi",
    );
  });
});

describe("mapLocation", () => {
  const spot = { latitude: -1.2595, longitude: 36.7736 };

  it("shows a merchant-placed pin as exact", () => {
    expect(mapLocation({ ...spot, precision: "pin" })).toEqual({ coordinate: spot, approximate: false });
  });

  it("marks an address lookup as approximate", () => {
    expect(mapLocation({ ...spot, precision: "address" })?.approximate).toBe(true);
  });

  it("hides the placeholder, whatever the precision says", () => {
    expect(mapLocation({ ...spot, precision: "none" })).toBeNull();
    expect(mapLocation({ ...NAIROBI_CENTER, precision: "pin" })).toBeNull();
  });
});
