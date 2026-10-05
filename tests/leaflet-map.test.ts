import { describe, expect, it, vi } from "vitest";

vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
vi.mock("react-native", () => ({ StyleSheet: { create: (s: unknown) => s }, View: "View" }));

const { buildHtml } = await import("@/components/LeafletMap");

const html = buildHtml({
  coordinate: { latitude: -1.2595, longitude: 36.7736 },
  approximate: true,
  editable: false,
});

describe("Leaflet map page", () => {
  it("loads only the pinned, integrity-checked Leaflet release", () => {
    expect(html).toContain('leaflet@1.9.4/dist/leaflet.js"\n  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="');
    expect(html).toContain('integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="');
  });

  it("embeds a script that parses and carries the coordinate", () => {
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('"lat":-1.2595');
    expect(script).toContain('"approximate":true');
  });
});
