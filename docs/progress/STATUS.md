# Progress status

Living log of what's shipped, what's blocked, and what needs a decision.
Updated as work lands — see `git log` for full commit detail; this is the
summary layer. Baseline: `675e0da` (initial delivery).

## Round 1 — Phase Zero, Week 1 code-only tasks (2026-09-03)

Scope: everything in the Phase Zero MVP spec achievable with no external
credentials/accounts. 11 commits, `5b1a3d2..59fce08` (plus `d71e196`).

**Shipped:**
- Standardized on pnpm (was an npm/pnpm docs mismatch)
- zod validation of the catalog API response at the fetch boundary +
  `src/observability/report.ts` (local failure-reporting seam)
- Catalog caching (stale-while-revalidate) + a remote kill switch
  (`appConfig.minVersion`, inert until the backend sends it)
- Deterministic native splash show/hide
- Analytics: session expiry (30 min) + fixed the anonymous-id startup race
- Analytics: batched/queued/retried event delivery (was one fire-and-forget
  POST per event)
- Root error boundary with a branded recovery screen
- Real contact channels (WhatsApp/call/website/Instagram/TikTok/email) on
  provider detail
- Swapped to `expo-image` for disk caching
- `ARCHITECTURE.md` + Prettier/ESLint reformat + proprietary `LICENSE`

**Blocked, not started:** real backend domain (§2.1), real icon/splash
assets at the time (§2.2 — later resolved, see Round 2), EAS login (§2.4),
Sentry DSN (§4.3 — later resolved, see below), Play Console (§5.1), support
WhatsApp number (§5.3), privacy notice content (§5.4).

## Interlude — Sentry + asset fixes (2026-09-03)

- Wired `@sentry/react-native` end to end (`0f502e9`): `Sentry.init` in
  `app/_layout.tsx`, `RootLayout` wrapped in `Sentry.wrap`, source-map/debug-
  symbol upload via the Expo config plugin + `getSentryExpoConfig`.
  `report()`/`reportMessage()` now forward to Sentry as well as logging
  locally. Org `kilimax-s5`, project `react-native`.
- Product owner supplied real assets mid-session: `logo.png` (app icon),
  category icons (`massage`, `nail-artist`, `tattoo`, later `barber`,
  `weightlifting`, `sauna`, `tray`, `clapper`), and `assets/splash/intro.mp4`
  (`160437b`).
- Fixed `app.json`'s `icon`/`splash.image` — they pointed at files that
  didn't exist (`cdcbffb`), now point at the real `logo.png`.

## Round 2 — Video Splash, Home Categories & Auth Gates (2026-09-03)

Scope: per the spec of that name, amending the Phase Zero PRD. 10 commits,
`822073d..7489e41`.

**Shipped:**
- `src/auth/auth-context.tsx` — the auth boundary. `status` always
  `"signed_out"`, every `start*` always resolves `"unavailable"`. No auth
  backend exists; this is UI scaffolding only.
- `app/auth.tsx` — login/signup modal, Kenyan phone validation reusing
  `normalizeKenyanPhone`
- Activity tab (`app/(tabs)/activity.tsx`) — signed-out empty state only, no
  invented appointment data
- Sign-in entry point added to the **Account** tab (kept that name — product
  owner explicitly overrode the spec's suggested rename to "Profile")
- Home category grid (`src/components/CategoryGrid.tsx`) — sourced from live
  catalog data, real icons where supplied, letter-fallback elsewhere,
  replaces the old single-row chip list in the same position
- Video splash (`src/components/VideoSplashGate.tsx`) — plays
  `assets/splash/intro.mp4`, gated on catalog-settle AND the video's actual
  first rendered frame (`onFirstFrameRender`, not just player
  `readyToPlay`), two independent 3s safety nets, reduced-motion skip
- `ARCHITECTURE.md` — added an "Auth boundary" section

**Deviations from the spec, flagged at the time:**
- §2.2's analytics ask ("reuse `search_submitted`" for a category-tile tap)
  reads semantically off — mixes home-browse taps into the real search
  funnel. Implemented as specified anyway (the spec explicitly invited
  flagging rather than silently adding a new event).
- Icon→category mappings for `barber`→barbering, `weightlifting`→fitness,
  `sauna`→recovery, `tray`→facials are inferred from filename, not
  confirmed. `clapper.png` is unmapped.
- Auth screen copy ("coming soon" message, headings) is placeholder wording,
  not owner-approved per §7 of that spec.
- The video asset (`intro.mp4`) and several category icons turned out to
  already exist in the repo, contrary to the spec's assumption that they
  were blockers — used directly rather than stubbed.

## Round 3 — Home hero redesign (2026-09-03)

Product owner supplied four alternative hero/search redesign concepts
(floating glass search bar, ambient video carousel, location+time header,
editorial category cards) and picked **editorial category cards** (`bc693ba`).

**Shipped:**
- Replaced the static dark headline+search-button hero box with a
  horizontal snap-carousel of compact cards
  (`src/components/EditorialCards.tsx`)
- Floating minimalist search icon in the top bar opens the existing search
  flow as a full-screen modal (`app/search-overlay.tsx` — re-exports the
  Search tab's component rather than duplicating its logic)
- Search screen now also accepts an optional `query` route param (mirrors
  the existing `category` param) so cards can deep-link into a pre-filled
  area search

**Flagged, not resolved:** card copy ("Most Booked Category: Spa & Massage",
"Popular Area: Kilimani", "Browse everything") is derived from real catalog
counts, not hand-written editorial content — the brief's example copy ("Top
Spa Recoveries", "New Barbering Spots", "Weekend Glow Up Deals") implies
curated claims (freshness, deals) the catalog snapshot has no data to back.
Needs real editorial content from the product owner to fully match the
original design intent.

## Round 4 — Expo SDK 57 fixes + backend build started (2026-09-04)

**Shipped (mobile app):**
- Fixed `app.json` schema errors under SDK 57: removed `newArchEnabled` and
  `android.edgeToEdgeEnabled` — both obsolete now that New Architecture and
  edge-to-edge are mandatory on Android 16; `expo-doctor` flagged them as
  invalid schema properties
- Bumped `@react-native-async-storage/async-storage` to the `2.2.0` SDK 57
  expects (`npx expo install --fix`); `expo-doctor` now 21/21 clean
- Root cause of the "Project is incompatible with this version of Expo Go"
  error diagnosed as an Expo-side distribution lag (SDK 57 shipped June 2026;
  Expo Go's app-store builds haven't caught up) — not a project
  misconfiguration. Workaround: install the SDK-matched client from
  `expo.dev/go` instead of the Play Store.
- Committed and pushed to `origin/main` (`7deb10d`).

**Backend build started (`kilipicks-server`, separate repo, no remote yet):**

Following the Phase Zero backend spec in
`.claude/architecture/kilipicks_backend.md .MD` (Node/Fastify + MySQL +
AdminJS, local-first). That repo had a DB pool, migration runner, and
migrations 001–010 already scaffolded but zero commits. This round:

- Committed the repo for the first time (`317fbf9`)
- Built merchant auth: signup, login, signout, me — bcrypt password hashing,
  bearer tokens with 90-day expiry/sliding window/3-token cap
  (`src/services/auth.js`, `src/middleware/merchant-auth.js`,
  `src/routes/auth/merchant.js`)
- Built the public catalog endpoint (`GET /api/public/catalog`) with a
  5-minute in-memory cache and `openNow` computed from Nairobi business
  hours (`src/services/catalog.js`, `src/services/open-now.js`), field-mapped
  directly against this repo's `src/schemas/catalog.ts` so the contract
  can't silently drift
- `npm run check:open-now` — 9/9 fixture cases passing (no DB required)

**Not yet verified live:** local MySQL needed a root password that wasn't
set until this session; migrations have not been confirmed to run yet, and
signup/login/me/catalog have not been smoke-tested against a running server.
The catalog + auth code past the first backend commit is uncommitted in that
repo pending that live verification.

## Round 5 — Backend consolidation: one server, real separate consumer/merchant auth (2026-09-07)

An audit of the project turned up two backends being built in parallel: the
spec'd `kilipicks-server` (Fastify/MySQL, separate `users`/`merchants`
tables, merchant auth + catalog built but never committed past the first
commit) and a second, unrelated JSON-file server at `backend/` in this repo
that had quietly become what the mobile app's email auth actually talked to
— and which modeled a person as one row with a `roles` array, directly
contradicting the backend PRD's "consumers and merchants never share a row,
a role field, or an auth system" rule. Round 5 resolves the fork:

**Shipped:**
- Moved `kilipicks-server` into this repo as `backend/` wholesale, Fastify/
  MySQL design intact (own `package.json`/`node_modules`, run via
  `pnpm backend:*` scripts that delegate with `npm --prefix backend`).
  Deleted the JSON-file server it replaces.
- Added real consumer auth (signup/login/signout/me) — Phase Zero's backend
  PRD had deferred this to Phase One, but the mobile app's profile-selection
  signup needs it now. New `users.password_hash` column and `user_tokens`
  table (migrations 012, 011), added as new migrations rather than editing
  001/002 in place, since those two were already applied against this
  machine's live MySQL instance with 2 real merchant rows in it.
- Modeled the consumer↔merchant relationship as `merchants.owner_user_id`
  (migration 013) — a nullable pointer between two fully separate tables,
  password hashes, and bearer-token namespaces (`kp_u_...` / `kp_m_...`),
  never a shared row. A person can hold both identities; each is
  independently authenticated. Extracted the shared sliding-expiry/
  3-token-cap token logic into `src/services/tokens.js` so the two systems
  can't drift apart on it.
- Rewired the mobile client end to end: `src/api/auth.ts`,
  `src/auth/auth-context.tsx` (now tracks `user`/`merchant` as separate
  optional sessions plus `merchantNeedsSignIn`), and the Account tab's
  "Switch to seller," which now prompts for its own business password
  instead of flipping a role flag with no credential of its own.
- Wrote the `scripts/smoke.mjs` that `npm run smoke` already referenced but
  that never existed. Live-verified against this machine's real MySQL:
  migrations 001–013 applied, signup/login/become-a-seller/cross-auth-
  rejection/duplicate-link-conflict all passing.

**Deliberately not done in this round:** merchant business CRUD (a merchant
can now authenticate but still has nowhere to create a business — the next
real gap), and repointing the mobile app's catalog fetch at `backend/`'s own
`GET /api/public/catalog` instead of the external demo host (that's a
separate decision — seeding real data and touching analytics' target host —
not bundled into an auth change).

**Not migrated:** the standalone `kilipicks-server` repo still exists on
disk, now superseded. Left in place rather than deleted, since it's a
separate repo with its own git history this session didn't own removing.

## Outstanding blockers (need something from the product owner)

| Item | Status |
|---|---|
| Real production backend domain + CORS | `backend/` (moved in from `kilipicks-server`) has real consumer + merchant auth, live-verified against local MySQL. Public catalog endpoint is built but the mobile app doesn't point at it yet — still on the demo host + dev-only Metro proxy. Merchant business CRUD (so a merchant has something to actually list) is the next gap, not yet built. |
| EAS login / `eas init` | Not started — no EAS account access |
| Play Console access | Not started |
| Support WhatsApp number | Not provided |
| Privacy notice content + legal review | Not started — now more urgent since the auth UI asks for real account credentials (email + password) |
| Auth screen copy sign-off | Placeholder wording in place, needs approval |
| Remaining category icons (hair, wigs, makeup, pilates, yoga) + `clapper.png`'s intended category | Not supplied / unclear |
| Real editorial content for the Home hero cards | Not supplied — current cards are algorithmically derived from catalog counts, not curated copy |
| Manual device testing | **Nothing from Round 2 or Round 3 has been run on a real device yet** — video splash timing, Sentry event delivery, the category grid's two-row layout, and the new hero cards/search overlay are all unverified beyond "the bundle compiles and serves" |

## Not yet true blockers, but worth knowing

- `pnpm typecheck` and `pnpm lint` are green as of `bc693ba`.
- Expo Go may not support all the native modules now in the tree
  (`expo-video`, `expo-image`, `@sentry/react-native`'s native crash
  capture) — a custom dev client (`npx expo run:android`) may be needed for
  full-fidelity testing.
