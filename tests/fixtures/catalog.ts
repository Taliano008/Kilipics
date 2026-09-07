import type { PublicCatalogProvider, PublicCatalogSnapshot } from "@/types/catalog";

export function makeProvider(
  overrides: Partial<PublicCatalogProvider> = {},
): PublicCatalogProvider {
  return {
    id: "provider-1",
    slug: "test-spa",
    industry: "wellness",
    categoryId: "spa",
    subcategory: null,
    name: "Test Spa",
    area: "Kilimani",
    distance: "1 km",
    mainOffering: "Massage",
    verified: true,
    openNow: true,
    cover: "https://example.com/cover.jpg",
    address: "1 Test Street",
    location: {
      latitude: -1.2921,
      longitude: 36.8219,
      fullAddress: "1 Test Street, Kilimani, Nairobi",
      area: "Kilimani",
      city: "Nairobi",
      locationType: "FIXED_VENUE",
      serviceAreas: [],
      landmark: "Test landmark",
      parkingAvailable: true,
    },
    paymentSettings: {
      allowPayAtVenue: true,
      requiresDeposit: false,
      instantConfirmation: false,
      acceptedPaymentMethods: ["M-Pesa"],
    },
    hours: "09:00-18:00",
    phone: "0712345678",
    serviceIds: [],
    specialistIds: [],
    highlights: [],
    facilities: [],
    wouldReturn: 0,
    trustMetric: "New",
    partnershipStatus: "signed",
    publicationStatus: "published",
    limitedListing: false,
    bookingEnabled: true,
    bookingMethod: "kilipicks",
    recommended: false,
    featured: false,
    gallery: [],
    publicContacts: {},
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<PublicCatalogSnapshot> = {},
): PublicCatalogSnapshot {
  return {
    providers: [makeProvider()],
    services: [],
    availability: [],
    managedMerchantIds: [],
    managedServiceIds: [],
    generatedAt: "2026-09-04T00:00:00.000Z",
    ...overrides,
  };
}
