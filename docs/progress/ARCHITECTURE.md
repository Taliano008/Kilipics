# Architecture

This is a client for the existing KiliPicks web platform's public catalog and
analytics APIs — not a standalone backend. Everything here describes the
mobile app's own structure; the backend (Cloudflare D1/R2, the public catalog
endpoint, the analytics ingest endpoint) is a separate codebase and workstream.

## Snapshot-based catalog model

`GET /api/public/catalog` returns one denormalized `PublicCatalogSnapshot` —
`providers`, `services`, `availability`, plus `managedMerchantIds`/
`managedServiceIds` and a `generatedAt` timestamp (`src/types/catalog.ts`,
derived from the zod schemas in `src/schemas/catalog.ts`). The client fetches
this wholesale and never paginates or queries server-side.

`src/catalog/catalog-context.tsx` owns the snapshot's lifecycle:

- On launch it hydrates instantly from an `AsyncStorage` cache
  (`kilipicks.catalog.snapshot.v1`) if one exists, then revalidates in the
  background — stale-while-revalidate. A network or schema-validation
  failure during revalidation never surfaces a full-screen error as long as
  a cache exists; it's reported via `report()` and the cache keeps showing.
- `stale` is derived from `generatedAt` being over 24h old and drives a
  subtle banner on the Home screen — not an error state.
- Every screen (`app/(tabs)/index.tsx`, `search.tsx`, `saved.tsx`,
  `app/provider/[id].tsx`) filters this in-memory array client-side (by
  category, text match, saved-id membership). That's a deliberate choice for
  a single-city seed-launch dataset: it's simpler and faster than a search
  endpoint at this size. **Phase One migration point:** once the catalog
  grows past what's comfortable to ship whole to every device, this needs a
  real server-side search/pagination endpoint, and `src/api/catalog.ts`'s
  single-fetch model needs revisiting (see §7.2 of the Phase Zero spec).

## Signed/unsigned partnership boundary

`partnershipStatus`, `limitedListing`, `bookingEnabled`, and `bookingMethod`
on each provider are decided entirely server-side and shipped as opaque
fields — the client's only job is to respect them, never re-derive
"is this a real partner" from other data.

Enforced in three places:

1. **`app/provider/[id].tsx`** — the `provider.limitedListing` branch hides
   services, pricing, gallery-heavy detail and the booking CTA for unclaimed
   listings, showing a "not yet claimed" notice instead. Public contact
   channels (`src/utils/contact-links.ts`) render **outside** that branch,
   regardless of `limitedListing` — they're public information (WhatsApp,
   phone, website, Instagram, TikTok, email), distinct from the in-app
   booking flow.
2. The booking CTA itself is additionally gated on `bookingEnabled`
   (`disabled={!provider.bookingEnabled}`).
3. **`app/booking/[providerId].tsx`** re-checks
   `!provider || provider.limitedListing || !provider.bookingEnabled`
   independently. This duplication is intentional defense-in-depth: a stale
   cached snapshot or a direct deep link could reach this screen without
   passing through the detail screen's gate first.

## Analytics pipeline

1. **Identity** (`src/analytics/events.ts`): an anonymous user id
   (`kilipicks.analytics.anonymous.v1`) is permanent and resolved once via a
   memoized promise, so concurrent `track()` calls on a fresh install can't
   race into minting two ids. A session id
   (`kilipicks.analytics.session.v2`) carries `lastActivityAt` and expires
   after 30 minutes of inactivity — checked lazily on the next tracked
   event rather than via an `AppState` listener, so `events.ts` stays a
   plain module with no React lifecycle concerns.
2. **Queueing** (`src/analytics/queue.ts`): every `track()` call enqueues an
   event into an `AsyncStorage`-backed buffer
   (`kilipicks.analytics.queue.v1`, capped at 500, oldest dropped first)
   instead of firing a request immediately.
3. **Flushing**: triggered at a 20-event threshold, a 30-second timer, or on
   app backgrounding (`src/analytics/use-analytics-lifecycle.ts`, wired once
   from `app/_layout.tsx`). A flush POSTs the entire current queue as one
   batch. A failed flush keeps every event queued and retries with jittered
   exponential backoff; a pending backoff also suppresses redundant
   threshold-triggered flush attempts so an outage doesn't hammer the
   network on every subsequent event.
4. Each event's `eventId` is generated once and reused across retries, so
   the backend's `eventId`-based dedup (§7.3 of the Phase Zero spec, not yet
   implemented server-side) prevents double-counting once it exists.

## The `report()` seam

`src/observability/report.ts` is the single seam every non-fatal failure
path in this app (queue flush failures, catalog schema-validation failures,
the root error boundary, contact-link open failures) calls instead of a
silent `catch {}`. It logs locally **and** forwards to Sentry
(`Sentry.captureException`/`captureMessage`) — Sentry is initialized in
`app/_layout.tsx` (`Sentry.init`, DSN for the `kilimax-s5`/`react-native`
project) and `RootLayout` is wrapped in `Sentry.wrap(...)`. Source-map/debug-
symbol upload is configured via `@sentry/react-native/expo`'s config plugin
in `app.json` and `getSentryExpoConfig` in `metro.config.js`.

## Auth boundary

Phase Zero has no auth backend at all — no OTP delivery, no session tokens,
no credential storage, no server to talk to. `src/auth/auth-context.tsx` is
the single seam every auth-adjacent screen goes through:

```ts
type AuthState = {
  status: "signed_out" | "signed_in"; // always "signed_out" in Phase Zero
  user: AuthUser | null;              // always null in Phase Zero
  startPhoneAuth: (e164: string) => Promise<AuthResult>;
  startEmailAuth: () => Promise<AuthResult>;
  startGoogleAuth: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
};
```

Every `start*` method always resolves `{ status: "unavailable", message }` —
no network call, no storage write. `AuthResult` also has `"success"` and
`"error"` variants that Phase Zero never returns, so a real provider can use
them later without changing the type. Screens (`app/auth.tsx`,
`app/(tabs)/activity.tsx`, `app/(tabs)/account.tsx`) only ever read `status`
and the `AuthResult` a `start*` call resolves to — never any local auth
state of their own. **When a real provider is wired in, only this file
changes.**

This also drove a product decision worth recording: `src/saved/saved-context.tsx`
(local `AsyncStorage`, no account, works offline) is deliberately **not**
gated behind auth — only the new Activity tab is, because Activity shows
appointment history (inherently tied to an account) while Saved is a plain
device-local shortlist. Gating Saved would only add friction to something
that already works standalone.

## Known Phase One migration points

- Real production API base URL; remove the Metro dev-only CORS proxy in
  `metro.config.js` and the `usesWebDevProxy` branch in `src/config/env.ts`
  once the backend sends correct CORS headers (§2.1).
- ~~Wire `report()` to a real crash-reporting SDK (§4.3).~~ Done — Sentry.
- Server-side catalog search/pagination once the dataset outgrows a single
  wholesale fetch (§7.1–7.2).
- The `appConfig.minVersion`/`message` remote kill switch
  (`src/components/UpgradeGate.tsx`) is fully implemented client-side but
  inert until the backend actually sends `appConfig` on the snapshot (§5.2).
- EAS build/submit pipeline and Play Console listing (§2.4, §5.1).
- Real support WhatsApp number for in-app feedback, and privacy notice
  content/legal review (§5.3, §5.4).
- Wire a real provider into `src/auth/auth-context.tsx` (OTP delivery,
  session tokens, credential storage) — every screen already consumes the
  boundary generically, so this should require zero screen edits.
- Collecting phone numbers in the auth UI is a materially different privacy
  posture than the current anonymous-analytics-only app, even though Phase
  Zero's auth never actually sends or stores one. The privacy notice and Play
  Data Safety declaration need to reflect that the UI now asks for a phone
  number, ahead of shipping this to real users.
