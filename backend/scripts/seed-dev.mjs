// Seeds local dev data so the mobile app has something other than an empty
// catalog to render against. Idempotent: re-running it drops and recreates
// the same slugs rather than accumulating duplicates.
//
// One business ("Zuri Beauty Lounge") is a fully claimed, booking-enabled
// listing — it exercises the provider detail screen's tab bar, tappable
// service rows, and Photos gallery instead of always hitting the
// limitedListing notice. Three more nails-category businesses exist purely
// so that provider's "Venues nearby" carousel has the minimum 3 candidates
// it requires to render.
import { execute, query, closePool } from "../src/db/connection.js";
import { newId } from "../src/lib/ids.js";
import { hashPassword } from "../src/services/auth.js";
import { invalidateCatalogCache } from "../src/services/catalog.js";

const MERCHANT_EMAIL = "demo-merchant@kilipicks.dev";

async function upsertMerchant() {
  const existing = await query("SELECT id FROM merchants WHERE email = ?", [
    MERCHANT_EMAIL,
  ]);
  if (existing.length > 0) return existing[0].id;

  const id = newId();
  const passwordHash = await hashPassword("DemoPass123!");
  await execute(
    `INSERT INTO merchants (id, full_name, email, password_hash, status)
     VALUES (?, ?, ?, ?, 'active')`,
    [id, "Demo Merchant", MERCHANT_EMAIL, passwordHash],
  );
  return id;
}

async function upsertBusiness(merchantId, business, services) {
  await execute("DELETE FROM businesses WHERE slug = ?", [business.slug]);

  const id = newId();
  await execute(
    `INSERT INTO businesses (
      id, merchant_id, slug, name, industry, category_id, subcategory,
      phone, area, full_address, latitude, longitude, location_type,
      hours, main_offering, positioning, starting_price, rating,
      verified_count, would_return, trust_metric, verified, recommended,
      featured, booking_enabled, booking_method, partnership_status,
      publication_status, limited_listing, cover_url, gallery_urls,
      public_contacts
    ) VALUES (
      ?, ?, ?, ?, 'beauty', ?, ?,
      ?, ?, ?, ?, ?, 'FIXED_VENUE',
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      'published', ?, ?, ?,
      ?
    )`,
    [
      id,
      merchantId,
      business.slug,
      business.name,
      business.categoryId,
      business.subcategory ?? null,
      business.phone,
      business.area,
      business.fullAddress,
      business.latitude,
      business.longitude,
      business.hours,
      business.mainOffering,
      business.positioning ?? null,
      business.startingPrice ?? null,
      business.rating ?? null,
      business.verifiedCount ?? 0,
      business.wouldReturn ?? 0,
      business.trustMetric ?? "",
      business.verified ? 1 : 0,
      business.recommended ? 1 : 0,
      business.featured ? 1 : 0,
      business.bookingEnabled ? 1 : 0,
      business.bookingMethod ?? "disabled",
      business.partnershipStatus ?? "unsigned",
      business.limitedListing ? 1 : 0,
      business.coverUrl ?? null,
      JSON.stringify(business.galleryUrls ?? []),
      JSON.stringify(business.publicContacts ?? {}),
    ],
  );

  for (const service of services) {
    await execute(
      `INSERT INTO services (
        id, business_id, category_id, industry, name, description,
        price, maximum_price, price_type, duration_minutes,
        booking_enabled, active, image_url
      ) VALUES (?, ?, ?, 'beauty', ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        newId(),
        id,
        business.categoryId,
        service.name,
        service.description ?? "",
        service.price,
        service.maximumPrice ?? null,
        service.priceType ?? "fixed",
        service.durationMinutes,
        service.bookingEnabled ? 1 : 0,
        service.imageUrl ?? null,
      ],
    );
  }

  return id;
}

async function main() {
  const merchantId = await upsertMerchant();

  await upsertBusiness(
    merchantId,
    {
      slug: "zuri-beauty-lounge",
      name: "Zuri Beauty Lounge",
      categoryId: "nails",
      subcategory: "Manicure & Pedicure",
      phone: "+254712345678",
      area: "Kilimani",
      fullAddress: "Argwings Kodhek Rd, Kilimani, Nairobi",
      latitude: -1.2921,
      longitude: 36.7872,
      hours: "Mon-Sat 8:00-20:00",
      mainOffering: "Manicures & Pedicures",
      positioning:
        "Nairobi's go-to nail studio for clean, long-lasting manicures and a relaxed pedicure chair.",
      startingPrice: 1500,
      rating: 4.8,
      verifiedCount: 132,
      wouldReturn: 0.94,
      trustMetric: "132 verified visits",
      verified: true,
      recommended: true,
      featured: true,
      bookingEnabled: true,
      bookingMethod: "kilipicks",
      partnershipStatus: "signed",
      limitedListing: false,
      coverUrl: "https://picsum.photos/seed/zuri-cover/900/600",
      galleryUrls: [
        "https://picsum.photos/seed/zuri-1/900/600",
        "https://picsum.photos/seed/zuri-2/900/600",
        "https://picsum.photos/seed/zuri-3/900/600",
      ],
      publicContacts: {
        whatsapp: "+254712345678",
        phone: "+254712345678",
        instagram: "https://instagram.com/zuribeautylounge",
      },
    },
    [
      {
        name: "Signature Gel Manicure",
        description: "Shape, cuticle care and long-wear gel polish.",
        price: 1500,
        priceType: "fixed",
        durationMinutes: 45,
        bookingEnabled: true,
      },
      {
        name: "Spa Pedicure",
        description: "Soak, scrub, massage and polish.",
        price: 2200,
        priceType: "fixed",
        durationMinutes: 60,
        bookingEnabled: true,
      },
      {
        name: "Custom Nail Art (per nail)",
        description: "Hand-painted detail work, ask in-studio for designs.",
        price: 500,
        priceType: "from",
        durationMinutes: 20,
        bookingEnabled: false,
      },
    ],
  );

  await upsertBusiness(
    merchantId,
    {
      slug: "glow-nail-bar",
      name: "Glow Nail Bar",
      categoryId: "nails",
      subcategory: "Nail Extensions",
      phone: "+254722334455",
      area: "Kilimani",
      fullAddress: "Wood Ave, Kilimani, Nairobi",
      latitude: -1.2935,
      longitude: 36.7861,
      hours: "Mon-Sun 9:00-19:00",
      mainOffering: "Nail Extensions",
      positioning: "Fast, tidy acrylics and gel-X in a bright Kilimani studio.",
      startingPrice: 1800,
      rating: 4.6,
      verifiedCount: 58,
      wouldReturn: 0.9,
      trustMetric: "58 verified visits",
      verified: true,
      recommended: false,
      featured: false,
      bookingEnabled: true,
      bookingMethod: "kilipicks",
      partnershipStatus: "signed",
      limitedListing: false,
      coverUrl: "https://picsum.photos/seed/glow-cover/900/600",
      galleryUrls: ["https://picsum.photos/seed/glow-1/900/600"],
      publicContacts: { whatsapp: "+254722334455", phone: "+254722334455" },
    },
    [
      {
        name: "Gel-X Extensions",
        description: "Full set, medium length.",
        price: 2500,
        priceType: "fixed",
        durationMinutes: 90,
        bookingEnabled: true,
      },
    ],
  );

  await upsertBusiness(
    merchantId,
    {
      slug: "nailed-it-nairobi",
      name: "Nailed It Nairobi",
      categoryId: "nails",
      subcategory: "Manicure",
      phone: "+254733445566",
      area: "Westlands",
      fullAddress: "Waiyaki Way, Westlands, Nairobi",
      latitude: -1.2673,
      longitude: 36.8065,
      hours: "",
      mainOffering: "Manicures",
      verified: false,
      recommended: false,
      featured: false,
      bookingEnabled: false,
      bookingMethod: "disabled",
      partnershipStatus: "unsigned",
      limitedListing: true,
      publicContacts: { phone: "+254733445566" },
    },
    [],
  );

  await upsertBusiness(
    merchantId,
    {
      slug: "polish-perfect",
      name: "Polish Perfect",
      categoryId: "nails",
      subcategory: "Manicure & Pedicure",
      phone: "+254744556677",
      area: "Kilimani",
      fullAddress: "Dennis Pritt Rd, Kilimani, Nairobi",
      latitude: -1.291,
      longitude: 36.7889,
      hours: "",
      mainOffering: "Manicures & Pedicures",
      verified: false,
      recommended: false,
      featured: false,
      bookingEnabled: false,
      bookingMethod: "disabled",
      partnershipStatus: "unsigned",
      limitedListing: true,
      publicContacts: { phone: "+254744556677" },
    },
    [],
  );

  invalidateCatalogCache();

  console.log("Seeded 4 businesses (1 merchant):");
  console.log("  - Zuri Beauty Lounge   (claimed, booking-enabled, hero listing)");
  console.log("  - Glow Nail Bar        (claimed, booking-enabled)");
  console.log("  - Nailed It Nairobi    (limited listing)");
  console.log("  - Polish Perfect       (limited listing)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
