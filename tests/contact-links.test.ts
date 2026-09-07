import { describe, expect, it } from "vitest";

import { buildContactChannels } from "@/utils/contact-links";

import { makeProvider } from "./fixtures/catalog";

describe("buildContactChannels", () => {
  it("builds safe links and prefers the dedicated WhatsApp number", () => {
    const channels = buildContactChannels(
      makeProvider({
        phone: "0712345678",
        publicContacts: {
          whatsapp: "+254 799 123 456",
          website: " https://example.com ",
          email: "hello@example.com",
          instagram: "javascript:alert(1)",
        },
      }),
    );

    expect(channels).toEqual([
      { kind: "whatsapp", label: "WhatsApp", url: "whatsapp://send?phone=254799123456" },
      { kind: "call", label: "Call", url: "tel:+254712345678" },
      { kind: "website", label: "Website", url: "https://example.com" },
      { kind: "email", label: "Email", url: "mailto:hello@example.com" },
    ]);
  });

  it("omits unavailable and unsafe contact values", () => {
    expect(buildContactChannels(makeProvider({ phone: "invalid" }))).toEqual([]);
  });
});
