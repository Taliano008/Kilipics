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

## Outstanding blockers (need something from the product owner)

| Item | Status |
|---|---|
| Real production backend domain + CORS | Not provided — still on the demo host + dev-only Metro proxy |
| EAS login / `eas init` | Not started — no EAS account access |
| Play Console access | Not started |
| Support WhatsApp number | Not provided |
| Privacy notice content + legal review | Not started — now more urgent since the auth UI asks for a phone number |
| Auth screen copy sign-off | Placeholder wording in place, needs approval |
| Remaining category icons (hair, wigs, makeup, pilates, yoga) + `clapper.png`'s intended category | Not supplied / unclear |
| Manual device testing | **Nothing in Round 2 has been run on a real device yet** — video splash timing, Sentry event delivery, and the category grid's two-row layout are unverified beyond "the bundle compiles and serves" |

## Not yet true blockers, but worth knowing

- `pnpm typecheck` and `pnpm lint` are green as of `7489e41`.
- Expo Go may not support all the native modules now in the tree
  (`expo-video`, `expo-image`, `@sentry/react-native`'s native crash
  capture) — a custom dev client (`npx expo run:android`) may be needed for
  full-fidelity testing.
