// End-to-end simulation of the real merchant journey against a running
// server (npm run dev in another terminal first): sign up a seller, complete
// onboarding steps 1-3 exactly as the mobile app's forms would, add real
// services, submit for review, then reproduce the one manual step Phase Zero
// intentionally requires — a human clicking "Publish" in the AdminJS panel
// (see backend/src/admin/index.js's businesses "publish" action) — before
// polling the public catalog until the listing actually goes live.
//
// This is not a throwaway smoke test: it leaves the account and business in
// place afterward so a developer can log into the mobile app with it and
// click around a real, live listing. Re-run it any time you want a fresh one
// (each run gets a unique timestamped email).
//
// Usage: node scripts/simulate-merchant-journey.mjs  (from backend/)
const baseUrl = process.env.SIM_BASE_URL || "http://localhost:3000";
const tag = Date.now();
const email = `demo.merchant+${tag}@kilipicks.test`;
const password = "KiliDemo!2026";
const businessName = "Nyota Braids & Beauty (Demo)";

function log(step, message) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${step.padEnd(22)} ${message}`);
}

async function call(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    // Only force JSON content-type when there's actually a body — Fastify
    // rejects an empty body paired with a declared application/json type
    // (FST_ERR_CTP_EMPTY_JSON_BODY), which the no-payload submit/publish
    // calls below would otherwise trip.
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function authed(token) {
  return { Authorization: `Bearer ${token}` };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const health = await call("/healthz");
  if (health?.db !== "up") throw new Error(`Backend DB not reachable: ${JSON.stringify(health)}`);
  log("health", `backend up at ${baseUrl}, db up`);

  // 1. Sign up as a merchant (mirrors the "I'm a business owner" signup
  // path — one call creates both the consumer row and a linked merchant row).
  const signup = await call("/api/auth/consumer/signup", {
    method: "POST",
    body: JSON.stringify({ fullName: "Amina Wanjiru", email, password, accountType: "merchant" }),
  });
  const merchantToken = signup.merchant?.token;
  if (!merchantToken) throw new Error("Signup did not return a merchant token");
  log("signup", `account created: ${email} (hasBusiness=${signup.merchant.profile.hasBusiness})`);

  // 2. Onboarding step 1 — business basics (app/merchant/onboard/step1.tsx).
  const step1 = await call("/api/merchant/business/step1", {
    method: "POST",
    headers: authed(merchantToken),
    body: JSON.stringify({
      name: businessName,
      category: "hair",
      description: "Feed-in braids, twists, and protective styles in the heart of Kilimani.",
      phone: "+254712345678",
      email,
    }),
  });
  const businessId = step1.business.id;
  log("step1", `business created: id=${businessId} slug=${step1.business.slug} status=${step1.business.publicationStatus}`);

  // 3. Onboarding step 2 — location (app/merchant/onboard/step2.tsx).
  await call("/api/merchant/business/step2", {
    method: "POST",
    headers: authed(merchantToken),
    body: JSON.stringify({
      address: "Woodvale Grove, Westlands, Nairobi",
      area: "Westlands",
      locationType: "physical",
      radius: 10,
      radiusEnabled: true,
    }),
  });
  log("step2", "location saved: Westlands, Nairobi");

  // 4. Onboarding step 3 — photos & full 7-day hours (app/merchant/onboard/step3.tsx).
  // Uses a real hosted demo image (same pattern as the mockup's PHOTO_SAMPLES),
  // and a distinct time per day so the client-side "Opening Times" fix
  // (app/provider/[id].tsx) has real varied data to prove it against, not a
  // uniform week that would look right even with the old hardcoded rows.
  const days = [
    { name: "Monday", open: true, from: "9:00 AM", to: "6:00 PM" },
    { name: "Tuesday", open: true, from: "9:00 AM", to: "6:00 PM" },
    { name: "Wednesday", open: true, from: "9:00 AM", to: "6:00 PM" },
    { name: "Thursday", open: true, from: "9:00 AM", to: "7:00 PM" },
    { name: "Friday", open: true, from: "9:00 AM", to: "7:00 PM" },
    { name: "Saturday", open: true, from: "10:00 AM", to: "5:00 PM" },
    { name: "Sunday", open: false },
  ];
  await call("/api/merchant/business/step3", {
    method: "POST",
    headers: authed(merchantToken),
    body: JSON.stringify({
      photos: [{ uri: "https://picsum.photos/seed/nyota-demo-cover/900/600" }],
      activePreset: "Custom",
      days,
    }),
  });
  log("step3", "photos + 7-day hours saved (Sunday closed)");

  // 5. Submit for review — the real "Finish setup" action. Per PRD §4,
  // this sets publicationStatus: draft + limitedListing: true; it does NOT
  // go live on its own.
  const submitted = await call("/api/merchant/business/submit", {
    method: "POST",
    headers: authed(merchantToken),
  });
  log("submit", `submitted for review: status=${submitted.business.publicationStatus} limitedListing=${submitted.business.limitedListing}`);

  // 6. Merchant-side preview — must work even while still in draft (this is
  // the new /api/merchant/business/preview endpoint powering "Consumer view"
  // -> /provider/me in the seller dashboard).
  const draftPreview = await call("/api/merchant/business/preview", { headers: authed(merchantToken) });
  log("preview(draft)", `merchant can already preview: "${draftPreview.provider.name}" publicationStatus=${draftPreview.provider.publicationStatus}`);

  // 7. Add real services (Profile -> Services tab), one bookable.
  const service1 = await call("/api/merchant/services", {
    method: "POST",
    headers: authed(merchantToken),
    body: JSON.stringify({
      name: "Feed-in Braids (Medium)",
      categoryId: "hair",
      priceType: "fixed",
      price: 2500,
      durationMinutes: 150,
      bookingEnabled: true,
      active: true,
      description: "Classic feed-in braids, no extensions included.",
    }),
  });
  await call("/api/merchant/services", {
    method: "POST",
    headers: authed(merchantToken),
    body: JSON.stringify({
      name: "Silk Press & Trim",
      categoryId: "hair",
      priceType: "from",
      price: 1500,
      durationMinutes: 90,
      bookingEnabled: false,
      active: true,
      description: "Heat styling with a precision trim.",
    }),
  });
  log("services", `2 services added (1 bookable: "${service1.service.name}")`);

  // 8. Merchant enables booking on the business itself (a real merchant
  // setting, gated separately from admin publish — see updateBusiness()'s
  // allowed-columns list in merchant-business.js).
  await call("/api/merchant/business", {
    method: "PATCH",
    headers: authed(merchantToken),
    body: JSON.stringify({ bookingEnabled: true }),
  });
  log("booking-enabled", "merchant turned booking on for their business");

  // 9. The one step with no API route by design: a human on the curation
  // team clicking "Publish" in AdminJS (backend/src/admin/index.js). We
  // reproduce its exact effect directly against the DB — same two columns,
  // same values — since AdminJS isn't running in this environment.
  const { execute, closePool } = await import("../src/db/connection.js");
  await execute("UPDATE businesses SET publication_status = 'published', limited_listing = 0, verified = 1 WHERE id = ?", [businessId]);
  log("admin-publish", "curation team published the listing (mirrors AdminJS's businesses.publish action)");

  // 10. The known Phase Zero catch: /api/public/catalog is served from a
  // 5-minute in-memory cache inside the already-running API process, and
  // that publish just happened via a direct DB write from this separate
  // script process — nothing told the running server's cache to drop early.
  // Poll for real, the same way a curious developer refreshing the app
  // would experience it, instead of asserting it's instant.
  log("poll", "waiting for the running server's catalog cache to pick up the publish (up to 5 min)...");
  const pollStart = Date.now();
  const maxWaitMs = 6 * 60 * 1000;
  let live = null;
  while (Date.now() - pollStart < maxWaitMs) {
    const catalog = await call("/api/public/catalog");
    live = catalog.providers.find((p) => p.id === businessId);
    if (live) break;
    await sleep(15000);
  }

  if (!live) {
    log("poll", `TIMEOUT after ${Math.round((Date.now() - pollStart) / 1000)}s — still not in /api/public/catalog. Check CACHE_TTL_MS in src/services/catalog.js, or restart the dev server to force a fresh read.`);
  } else {
    const elapsedS = Math.round((Date.now() - pollStart) / 1000);
    log("live", `business now visible in the real consumer catalog after ${elapsedS}s — name="${live.name}" limitedListing=${live.limitedListing} bookingEnabled=${live.bookingEnabled}`);
  }

  // 11. Prove the booking flow round-trips against this exact listing, the
  // same request app/booking/[providerId].tsx sends.
  const booking = await call("/api/public/availability-requests", {
    method: "POST",
    body: JSON.stringify({
      businessId,
      serviceId: service1.service.id,
      consumerName: "Test Client",
      whatsappNumber: "+254700000000",
      preferredDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      preferredTime: "afternoon",
      notes: "Simulated end-to-end booking request.",
    }),
  });
  log("booking", `availability request submitted: id=${booking.request.id} status=${booking.request.status}`);

  await closePool();

  console.log("\n--- Test account (left live for manual poking) ---");
  console.log(`  email:      ${email}`);
  console.log(`  password:   ${password}`);
  console.log(`  businessId: ${businessId}`);
  console.log(`  slug:       ${step1.business.slug}`);
  console.log(`  preview:    open the app as this merchant -> Profile -> "Consumer view" -> /provider/me`);
  console.log(`  public:     /provider/${businessId} once ${live ? "(already live)" : "the cache catches up"}`);
}

main().catch((error) => {
  console.error("\nSimulation failed:", error);
  process.exitCode = 1;
});
