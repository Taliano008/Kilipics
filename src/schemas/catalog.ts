import { z } from "zod";

// Mirrors src/types/catalog.ts field-for-field. Required/optional here must
// match the `?` markers there exactly — zod objects already strip unknown
// keys by default rather than erroring, which is what makes this permissive
// about fields the backend adds later while staying strict about the fields
// the app actually depends on.

export const partnershipStatusSchema = z.enum(["signed", "unsigned"]);
export const publicationStatusSchema = z.enum(["draft", "published", "hidden", "archived"]);
export const bookingMethodSchema = z.enum(["kilipicks", "whatsapp", "phone", "external", "disabled"]);

const providerLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  fullAddress: z.string(),
  area: z.string(),
  city: z.literal("Nairobi"),
  locationType: z.enum(["FIXED_VENUE", "MOBILE_SERVICE", "BOTH"]),
  serviceAreas: z.array(z.string()),
  landmark: z.string(),
  parkingAvailable: z.boolean(),
});

const providerPaymentSettingsSchema = z.object({
  allowPayAtVenue: z.boolean(),
  requiresDeposit: z.boolean(),
  instantConfirmation: z.boolean(),
  acceptedPaymentMethods: z.array(z.enum(["M-Pesa", "Voucher", "Pay at Venue"])),
});

export const publicContactsSchema = z
  .object({
    phone: z.string(),
    whatsapp: z.string(),
    email: z.string(),
    instagram: z.string(),
    tiktok: z.string(),
    website: z.string(),
  })
  .partial();

export const publicCatalogProviderSchema = z.object({
  id: z.string(),
  slug: z.string(),
  industry: z.enum(["beauty", "wellness"]),
  categoryId: z.string(),
  subcategory: z.string().nullish(),
  name: z.string(),
  area: z.string(),
  distance: z.string(),
  rating: z.number().optional(),
  verifiedCount: z.number().optional(),
  startingPrice: z.number().optional(),
  mainOffering: z.string(),
  verified: z.boolean(),
  openNow: z.boolean(),
  cover: z.string(),
  address: z.string(),
  location: providerLocationSchema,
  paymentSettings: providerPaymentSettingsSchema,
  hours: z.string(),
  phone: z.string(),
  serviceIds: z.array(z.string()),
  specialistIds: z.array(z.string()),
  highlights: z.array(z.string()),
  facilities: z.array(z.string()),
  wouldReturn: z.number(),
  trustMetric: z.string(),
  nextAvailable: z.string().optional(),
  positioning: z.string().optional(),
  partnershipStatus: partnershipStatusSchema,
  publicationStatus: publicationStatusSchema,
  limitedListing: z.boolean(),
  bookingEnabled: z.boolean(),
  bookingMethod: bookingMethodSchema,
  recommended: z.boolean(),
  featured: z.boolean(),
  gallery: z.array(z.string()),
  publicContacts: publicContactsSchema,
});

export const publicCatalogServiceSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  categoryId: z.string(),
  industry: z.enum(["beauty", "wellness"]),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  maximumPrice: z.number().optional(),
  priceType: z.enum(["fixed", "from", "range", "contact_for_price"]),
  durationMinutes: z.number(),
  bookingEnabled: z.boolean(),
  active: z.boolean(),
  imageUrl: z.string().optional(),
});

export const publicCatalogAvailabilitySchema = z.object({
  id: z.string(),
  providerId: z.string(),
  serviceId: z.string(),
  professionalId: z.string(),
  date: z.string(),
  time: z.string(),
  endTime: z.string().optional(),
  availableSlots: z.number(),
});

// Optional forward-looking remote kill switch (see §5.2 of the Phase Zero
// spec). The current backend does not send this field yet — that's fine,
// a missing appConfig means "no version constraint," so this stays inert
// until the backend adds it.
export const appConfigSchema = z
  .object({
    minVersion: z.string(),
    message: z.string(),
  })
  .partial()
  .optional();

export const publicCatalogSnapshotSchema = z.object({
  providers: z.array(publicCatalogProviderSchema),
  services: z.array(publicCatalogServiceSchema),
  availability: z.array(publicCatalogAvailabilitySchema),
  managedMerchantIds: z.array(z.string()),
  managedServiceIds: z.array(z.string()),
  generatedAt: z.string(),
  appConfig: appConfigSchema,
});

export type PartnershipStatus = z.infer<typeof partnershipStatusSchema>;
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;
export type BookingMethod = z.infer<typeof bookingMethodSchema>;
export type PublicContacts = z.infer<typeof publicContactsSchema>;
export type PublicCatalogProvider = z.infer<typeof publicCatalogProviderSchema>;
export type PublicCatalogService = z.infer<typeof publicCatalogServiceSchema>;
export type PublicCatalogAvailability = z.infer<typeof publicCatalogAvailabilitySchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
export type PublicCatalogSnapshot = z.infer<typeof publicCatalogSnapshotSchema>;
