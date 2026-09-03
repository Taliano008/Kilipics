// Types are derived from the zod schemas in @/schemas/catalog so the runtime
// validation and the compile-time types can never drift apart. Re-exported
// here under their original names so no existing import site needs to change.
export type {
  AppConfig,
  BookingMethod,
  PartnershipStatus,
  PublicationStatus,
  PublicCatalogAvailability,
  PublicCatalogProvider,
  PublicCatalogService,
  PublicCatalogSnapshot,
  PublicContacts,
} from "@/schemas/catalog";
