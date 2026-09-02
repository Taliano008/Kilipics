export type PartnershipStatus = "signed" | "unsigned";
export type PublicationStatus = "draft" | "published" | "hidden" | "archived";
export type BookingMethod = "kilipicks" | "whatsapp" | "phone" | "external" | "disabled";

export type PublicCatalogProvider = {
  id: string;
  slug: string;
  industry: "beauty" | "wellness";
  categoryId: string;
  subcategory?: string | null;
  name: string;
  area: string;
  distance: string;
  rating?: number;
  verifiedCount?: number;
  startingPrice?: number;
  mainOffering: string;
  verified: boolean;
  openNow: boolean;
  cover: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
    fullAddress: string;
    area: string;
    city: "Nairobi";
    locationType: "FIXED_VENUE" | "MOBILE_SERVICE" | "BOTH";
    serviceAreas: string[];
    landmark: string;
    parkingAvailable: boolean;
  };
  paymentSettings: {
    allowPayAtVenue: boolean;
    requiresDeposit: boolean;
    instantConfirmation: boolean;
    acceptedPaymentMethods: ("M-Pesa" | "Voucher" | "Pay at Venue")[];
  };
  hours: string;
  phone: string;
  serviceIds: string[];
  specialistIds: string[];
  highlights: string[];
  facilities: string[];
  wouldReturn: number;
  trustMetric: string;
  nextAvailable?: string;
  positioning?: string;
  partnershipStatus: PartnershipStatus;
  publicationStatus: PublicationStatus;
  limitedListing: boolean;
  bookingEnabled: boolean;
  bookingMethod: BookingMethod;
  recommended: boolean;
  featured: boolean;
  gallery: string[];
  publicContacts: Partial<Record<"phone" | "whatsapp" | "email" | "instagram" | "tiktok" | "website", string>>;
};

export type PublicCatalogService = {
  id: string;
  providerId: string;
  categoryId: string;
  industry: "beauty" | "wellness";
  name: string;
  description: string;
  price: number;
  maximumPrice?: number;
  priceType: "fixed" | "from" | "range" | "contact_for_price";
  durationMinutes: number;
  bookingEnabled: boolean;
  active: boolean;
  imageUrl?: string;
};

export type PublicCatalogAvailability = {
  id: string;
  providerId: string;
  serviceId: string;
  professionalId: string;
  date: string;
  time: string;
  endTime?: string;
  availableSlots: number;
};

export type PublicCatalogSnapshot = {
  providers: PublicCatalogProvider[];
  services: PublicCatalogService[];
  availability: PublicCatalogAvailability[];
  managedMerchantIds: string[];
  managedServiceIds: string[];
  generatedAt: string;
};
