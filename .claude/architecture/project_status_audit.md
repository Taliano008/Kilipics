# KiliPicks — Project Status Audit

**Audit date:** 2026-09-15
**Repo:** `github.com/Taliano008/Kilipics`, branch `main` @ `fb8d5a1`
**History:** 50 commits, 2026-09-02 → 2026-09-15 (13 days)
**Method:** Direct inspection of the codebase, migrations, and registered
backend routes against the three specs in this folder
(`merchant_prd.md`, `kilipicks_backend.md`, `Home_upgrade.MD`). Not based
on commit messages or prior summaries — every claim below was verified by
reading the actual route registrations, screen files, or database schema.

---

## 1. What KiliPicks is

A single Expo/React Native app with two modes over one Fastify + MySQL
backend:

- **Consumer mode** — browse, search, and request availability at beauty
  and wellness businesses in Nairobi.
- **Merchant ("seller") mode** — a business owner manages their own
  listing. Reached via "Switch to seller" from the consumer Account tab.

Two independent auth systems by design (consumers and merchants never
share a row or a token type), bridged by one endpoint
(`POST /api/auth/consumer/merchant`).

---

## 2. What's actually working end-to-end

### Consumer app
- **Home** (`app/(tabs)/index.tsx`) — hero categories, category grid with
  live counts, new listings, nearby venues, nearby professionals, recently
  viewed (AsyncStorage-backed).
- **Search** (`app/(tabs)/search.tsx`, 311 lines) — sorting, recent
  searches, empty states.
- **Provider detail** (`app/provider/[id].tsx`) — fully matches
  `Home_upgrade.MD`'s spec: sticky anchor tab bar (Photos/Services/Hours/
  Nearby), "Venues nearby" carousel, and service rows that deep-link into
  booking with that specific service pre-selected. All three acceptance
  criteria in that spec are met.
- **Saved** (`app/(tabs)/saved.tsx`) — sectioned, working.
- **Account** (`app/(tabs)/account.tsx`) — sign in/out, saved count, the
  seller-mode entry point.
- **Activity** — correctly shows an honest empty state rather than a fake
  booking history, because there is no real booking data yet (see §3).
- **Auth** — email signup/login, consumer + merchant tokens, session
  persisted via AsyncStorage.
- **Analytics** — anonymous ID + session tracking, event queue, ingest
  endpoint on the backend. `service_added` was added this session.

### Merchant app
- **Onboarding, steps 1–4** (`app/merchant/onboard/*`) — personal details,
  business details (category sheet sourced from the real catalog taxonomy,
  not hardcoded), location, photos/hours/description. Submission sets
  `publicationStatus: draft`, `limitedListing: true`.
- **Profile / Overview tab** (`app/merchant/profile.tsx`) — hero card,
  trust badges, About (editable), Studio Gallery (camera/library upload,
  now compressed — see §5), Location & Hours. Overview and Reviews tabs
  now render distinct content (fixed this session — previously every tab
  showed the same Overview content).
- **Services** (`app/merchant/services.tsx`) — full CRUD: list with
  live-preview strip, add/edit form (photo, category, price type incl.
  range, duration stepper), archive vs. hard-delete, duplicate, manual
  reorder (persisted). Built this session, backed by a real API.

### Backend
- Two auth route trees (`/api/auth/consumer`, `/api/auth/merchant`),
  bridged by the "become a merchant" endpoint.
- Merchant business onboarding API (steps 1–3, submit, patch).
- Merchant media upload (`/api/merchant/media/photos`), purpose-tagged
  (cover/gallery/look/service).
- **Merchant services CRUD** (`/api/merchant/services/*`) — built this
  session: list, create, update, archive, duplicate, delete, reorder.
  Diverges intentionally from `kilipicks_backend.md` §6.3's URL shape
  (`/businesses/:businessId/services`) — it uses the same
  token-resolves-business pattern as every other merchant route instead of
  a path param, which is more consistent with the rest of this codebase.
- Public catalog snapshot (`/api/public/catalog`) with a 5-minute
  in-memory cache, invalidated on every merchant mutation.
- Analytics ingest (`/api/analytics/events`).
- 17 migrations, `001` through `017`.

### Cross-cutting
- Shared design tokens (`src/theme/tokens.ts`, `src/theme/merchant.ts`),
  category taxonomy (`src/utils/categories.ts`), phone normalization,
  contact-link builder, a small icon-asset registry
  (`src/utils/icon-assets.ts`, added this session).
- `tsc --noEmit` and `eslint .` both currently clean across the repo.
- 4 unit-test files (`phone`, `contact-links`, `catalog-schema`, `utils`)
  under `vitest`.

---

## 3. Built, but not actually connected to reality

These are the gaps most likely to surprise someone testing the app, because
the UI looks finished but nothing happens behind it.

| What | Where | Status |
|---|---|---|
| **"Check availability" booking request** | `app/booking/[providerId].tsx` | The entire form (calendar, time, WhatsApp, consent) works and submits — into a `setTimeout` and a `console.log`. No backend endpoint exists. **No human is notified when a real customer submits this today.** |
| **Admin review/publish tooling** | backend | `adminjs`, `@adminjs/fastify`, `@adminjs/sql` are installed dependencies (`kilipicks_backend.md` §8 specs a full admin panel) but **never registered in `app.js`**. There is currently no way — UI or otherwise — for anyone to flip a merchant's `publicationStatus` from `draft` to `published`. Every onboarded merchant is permanently stuck in "pending review." |
| **Privacy policy** | `app/privacy.tsx` | Explicitly marked `PLACEHOLDER COPY` in the screen itself and referenced as such in the booking screen's own code comments. Not legally reviewed. |
| **Auth spec doc** | — | `merchant_prd.md` §7 requires "the auth boundary defined in `KiliPicks-Auth-And-Onboarding-Spec.md`" as a prerequisite and names it again in the commit sequence (§11.1). That file does not exist anywhere in this repo. Auth clearly got built anyway (and reasonably so), but there's no written spec backing it up. |

---

## 4. Specified but entirely unbuilt

Straight from `merchant_prd.md` §5 (seller dashboard) and
`kilipicks_backend.md` §6.4–6.6. Confirmed by grepping the actual route
registrations and screen files — none of the below exist in any form.

- **Seller dashboard shell.** The PRD calls for five tabs (Bookings,
  Sales, Looks, Inbox, Profile) with a persistent "Switch to consumer
  view" header. What exists instead: `app/merchant/_layout.tsx` is a plain
  `Stack`, and `profile.tsx` has its own hand-rolled 4-item bottom bar
  (Overview/Services/Bookings/Account) where **Bookings does nothing when
  tapped.**
- **Bookings tab.** No calendar/agenda view, no manual-booking creation,
  no availability controls. Backend: `GET/POST /api/merchant/bookings` and
  the availability endpoints are fully specified in
  `kilipicks_backend.md` §6.4/§6.5 — none are implemented, despite the
  `bookings` and `availability` tables already existing (migrations `005`,
  `006`).
- **Sales tab.** Nothing — no local storage model, no UI. No
  `transactions` table exists either.
- **Looks tab.** Nothing beyond the `looks` table (migration `007`) and
  the backend PRD's §6.6 spec. No routes, no screens, no create-look flow.
- **Inbox tab.** Nothing — no WhatsApp chat list, no activity feed, no
  support shortcut screen.
- **Mode persistence.** PRD §8 requires the active mode (consumer/seller)
  to persist to `AsyncStorage` so the app reopens in the last-used mode.
  Not implemented — today "switch to seller" is a one-way navigation, not
  a remembered app state.

---

## 5. Fixed this session (for context, not action)

- Merchants without a completed business were landing directly on the
  Profile/Overview screen instead of onboarding, because "Switch to
  seller" only checked whether a merchant *identity* existed, not whether
  a *business* did. Also fixed a related backend bug where `/login` and
  `/me` never returned `hasBusiness`, which would have sent even
  fully-onboarded returning merchants back through onboarding.
- Camera/library photo uploads were failing on real (non-test) images
  because nothing in the app compressed a photo before upload — a
  full-resolution modern phone photo routinely exceeds the backend's 10MB
  cap. Added `expo-image-manipulator`-based resize+compress to the shared
  photo picker.
- Built the Services tab end-to-end (backend + screen) — previously a
  dead "NEW" pill.
- Replaced a handful of standalone emoji with real icon assets
  (ratings, verified badges, WhatsApp, saved) where a clear asset match
  existed.

---

## 6. Immediate checklist

Ordered by what actually blocks real usage first.

### P0 — blocking any real user interaction
1. **Wire the availability-request booking flow to a real endpoint**, and
   make sure a human actually gets notified (WhatsApp/Slack/email — pick
   one). Right now every consumer booking request silently vanishes.
2. **Stand up a way to publish a merchant's listing.** Either wire up the
   already-installed AdminJS panel, or ship a minimal manual path (even a
   script) so a reviewed business can move from `draft` to `published`.
   Without this, onboarding is a dead end for every merchant.
3. **Replace the placeholder privacy policy** with legally-reviewed copy
   before collecting any real user's name/phone/location.

### P1 — core PRD scope still open
4. Build the seller dashboard shell (real 5-tab nav) so Bookings/Sales/
   Looks/Inbox have somewhere to live and Profile isn't faking its own
   bottom nav.
5. Bookings tab — calendar/agenda, manual booking creation, availability
   controls. Backend routes are already spec'd (`kilipicks_backend.md`
   §6.4/§6.5); the tables exist. This is the biggest single chunk of
   unbuilt work in the PRD.
6. Sales tab — local-only income tracker (per PRD, no backend needed yet).
7. Looks tab — portfolio feed + create-look flow.
8. Inbox tab — WhatsApp deep-link chat list, activity feed, support.

### P2 — hygiene, before it bites someone
9. Confirm `EXPO_PUBLIC_USE_MOCK_CATALOG` is `false` before any real demo
   or release — it's currently `true` in `.env.local`, meaning Home/Search
   are running on canned data, not the live catalog, in this environment.
10. Persist the active mode (consumer/seller) to `AsyncStorage` per PRD §8.
11. Expand test coverage — 4 unit-test files total, none covering the
    merchant services API, the onboarding-gate logic, or photo
    compression, all of which were bug sources this session.
12. Either write the `KiliPicks-Auth-And-Onboarding-Spec.md` that
    `merchant_prd.md` references, or update the PRD to stop pointing at a
    file that doesn't exist.
