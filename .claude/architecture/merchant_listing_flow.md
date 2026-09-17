# Merchant → Client Listing Flow — Fluid End-to-End Verification

**Status:** Verified end-to-end against a real backend + MySQL, not yet
committed/pushed.
**Question this answers:** "If a merchant signs up, adds their business, and
finishes onboarding — does that business actually become visible and
interactive for a real client, without any static/mock data standing in the
way?" As of this pass: yes, confirmed by running the real flow, not just by
reading the code.

---

## 1. The headline bug this pass fixed

**The consumer app was showing 100% fake data by default**, regardless of
how correct the real backend wiring was. `.env.local` had
`EXPO_PUBLIC_USE_MOCK_CATALOG=true` — `src/catalog/catalog-context.tsx` reads
that flag and, when true, never calls the real `/api/public/catalog` at all;
it just loads `src/catalog/mock-catalog-data.ts`'s hardcoded providers
(`"mock-1"`, "The Braid Bar Nairobi", etc.) into every screen that reads
`useCatalog()` — Home, Search, the provider detail page, and Booking.

**Fixed:** `.env.local`'s flag is now `false`. This one flag was the entire
reason "a merchant adds a business but nothing shows up for clients" could
happen even though the merchant-side onboarding → backend → database wiring
was already real and working. If you ever see a business you *know* is
published not showing up, check this flag first before anything else.

---

## 2. What "fluid" required, beyond the flag

Flipping the flag exposed two more real (not hypothetical) gaps between what
merchants enter and what the client-facing UI actually rendered:

### a) Merchants had no way to preview their own listing before it's published

Every business is created with `publicationStatus: draft` and stays that way
until a human on the curation team publishes it (see §3) — intentional, per
`merchant_prd.md` §4. But `/api/public/catalog` only ever returns
`publication_status = 'published'` rows, and the merchant dashboard's
"Consumer view" button (`src/components/merchant/DashboardHeader.tsx`) used
to just open the generic `/(tabs)` Home tab — not the merchant's own listing.
A merchant had **no way to see their own storefront** until an admin
published it, which defeats "preview it on the merchant side."

**Fixed** with a new preview path that works at any publication status:

- `backend/src/services/catalog.js` — `serializeProvider`/`serializeService`
  are now exported (previously module-private).
- `backend/src/services/merchant-business.js` — new `getBusinessPreview(merchantId)`,
  reusing those exact serializers so the preview payload is byte-for-byte the
  same shape the public catalog returns, just unfiltered by publish status.
- `backend/src/routes/merchant/business.js` — new
  `GET /api/merchant/business/preview` (merchant-authed).
- `src/api/merchant.ts` — `fetchMerchantBusinessPreview(token)`.
- `app/provider/[id].tsx` — now has a special sentinel route,
  **`/provider/me`**. When `id === "me"`, the screen fetches the merchant's
  own business via the preview endpoint instead of looking it up in the
  public catalog, and renders through the *exact same* UI a client sees —
  same hero, same services list, same booking button (correctly
  disabled/enabled by the real `limitedListing`/`bookingEnabled` flags,
  since a draft business always has `limitedListing: true`, matching what a
  client would actually experience). A banner at the top says "Draft
  preview — not visible to clients yet" until the business is published.
- `DashboardHeader.tsx`'s "Open Public Storefront" now routes to
  `/provider/me` instead of the generic Home tab.

### b) The client-facing hours card ignored real data the merchant entered

`app/provider/[id].tsx`'s "Opening Times" card showed `provider.hours` for a
single "Monday - Friday" row, then **hardcoded** "Saturday 08:00-20:00" and
"Sunday Closed" for every business, regardless of what the merchant actually
set in onboarding step 3. Merchants *do* enter a real 7-day schedule
(`backend/src/services/merchant-business.js`'s `saveStep3` already formats
it into a `"Monday: 9:00 AM – 6:00 PM\n..."` multi-line string stored in
`businesses.hours`) — the client screen just never rendered the real Sat/Sun
values.

**Fixed:** the card now parses `provider.hours` into real per-day rows and
renders whatever the merchant actually entered, for all 7 days. Falls back
to an honest "Hours not set yet" row (not a fabricated default) only when a
business genuinely has no hours saved.

### c) A misleading 500 in the shared error handler

Unrelated to the above two, but found while building the verification
script below: `backend/src/app.js`'s global error handler only special-cased
`ApiError` and ajv `validation` errors — any other error (including
Fastify's own built-in errors, e.g. an empty body sent with
`Content-Type: application/json`) fell through to a generic
`{error: "internal_error", message: "Something went wrong."}` **500**, even
when the underlying error already carried a correct 4xx `statusCode`. Fixed
by respecting `err.statusCode` when present and `< 500` before falling back
to the generic 500 branch. Low-risk, additive — makes client-fault errors
report as 4xx instead of masquerading as a server crash.

---

## 3. The one step that's still manual, on purpose

Per `merchant_prd.md` §4: *"'Finish setup' button publishes the listing as
`publicationStatus: draft` ... until the team reviews and publishes it."*
There is no auto-publish path, by design — this is a Phase Zero curation
gate, not a bug. The only code path that sets `publication_status =
'published'` is the AdminJS "Publish" record action
(`backend/src/admin/index.js`), run by a human at `/admin`
(`npm run admin:dev` in `backend/`, separate process/port — see
`seller_dashboard_implementation.md` for why it's a separate process).

**Known latency this implies:** `/api/public/catalog` is served from a
5-minute in-memory cache local to the running API process
(`backend/src/services/catalog.js`, `CACHE_TTL_MS`). Neither the AdminJS
publish action nor the merchant's own `PATCH /api/merchant/business` calls
`invalidateCatalogCache()` in a way that reaches a *different* process — and
AdminJS *is* a different process from the main API by design. So a freshly
published business can take up to 5 minutes to actually appear for clients,
even though the merchant-side preview (`/provider/me`, §2a) shows it
immediately regardless of cache state. This was already an accepted Phase
Zero tradeoff; not something this pass tried to re-architect. If this
latency becomes a real problem, the fix is a shared invalidation signal
(e.g. a `cache_generation` row in `app_config` that `getCatalogSnapshot()`
checks) rather than trying to keep two processes' in-memory caches in sync.

---

## 4. Verified via a real, repeatable simulation

`backend/scripts/simulate-merchant-journey.mjs` — run it any time with
`node scripts/simulate-merchant-journey.mjs` from `backend/` (server must
already be running, `npm run dev`). It is **not a throwaway test**: it
leaves the account and business live afterward so you can log into the
mobile app with it. Each run creates a fresh timestamped account, so re-run
it freely.

What it actually exercises, against the real running server and real MySQL
database (no mocks, no stubs):

1. `POST /api/auth/consumer/signup` (`accountType: "merchant"`) — real account creation.
2. Onboarding steps 1–3, same payload shapes the mobile forms send, including
   a full real 7-day hours schedule with Sunday closed and varied weekday
   hours (specifically to prove the §2b hours fix against non-uniform data).
3. `POST /api/merchant/business/submit` — real submission, confirms it stays
   `publicationStatus: draft`.
4. `GET /api/merchant/business/preview` **while still in draft** — confirms
   the merchant-side preview (§2a) works before any admin action.
5. Two real services created via `POST /api/merchant/services`, one
   booking-enabled.
6. The merchant turns booking on for their business via the real
   `PATCH /api/merchant/business` endpoint.
7. The one manual step (§3) is reproduced with the exact same DB effect the
   AdminJS "Publish" button has (there's no AdminJS process running by
   default in a dev environment, so this talks to the DB directly rather
   than driving a browser session — the effect is identical either way).
8. Polls the real `GET /api/public/catalog` until the business actually
   appears, logging how long it took — proving the flow end-to-end instead
   of asserting it.
9. Submits a real booking request via `POST /api/public/availability-requests`
   against the newly published business, the same call
   `app/booking/[providerId].tsx` makes.

Last run: business appeared in the public catalog and a booking request was
accepted successfully — full loop confirmed working.

---

## 5. What's still not dynamic (out of scope for this pass, flagged for later)

These were already known before this pass (see `project_status_audit.md`
and `seller_dashboard_implementation.md`) and weren't part of "does a
business a merchant adds actually reach clients" — they're decorative
content on the provider page, not data merchants enter:

- `app/provider/[id].tsx`'s `PERKS` and `REVIEWS` arrays — same 4 perks and
  6 fabricated reviews shown on every business. No reviews feature exists
  yet.
- The "Additional Information" card ("Instant confirmation" / "Pay by app")
  — static, not driven by `provider.paymentSettings` (which onboarding
  doesn't collect in Phase Zero).
- `app/merchant/onboard/step1.tsx`'s logo upload button — no `onPress`,
  decorative only.
- `app/merchant/onboard/step2.tsx`'s map image — a single static image for
  every address, no real geocoding/map rendering.
