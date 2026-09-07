# KiliPicks — Provider Detail Screen Improvements

**Document type:** Implementation spec for Claude Code
**Repo:** `github.com/Taliano008/Kilipics`
**Baseline:** `7deb10d`
**File:** `app/provider/[id].tsx`
**Design reference:** A Fresha-style spa detail page (HTML mockup supplied
by product owner)
**Decision:** Take three structural patterns from the reference. Reject
everything that requires data or capability the app doesn't have.

---

## 0. What this spec is and isn't

The reference mockup is a full-featured venue page with a team section, a
review count, a live map, and a booking modal that ends in a fake
"Booking confirmed!" alert. Most of that does not belong in this app yet.

This spec covers the three things that are genuinely better than what
exists today **and** buildable with zero backend changes and zero new
data:

1. A sticky anchor tab bar for wayfinding on a long detail page.
2. A "Venues nearby" section so a wrong-fit listing has a next step
   instead of a dead end.
3. Service rows that deep-link into the booking flow with that specific
   service pre-selected, instead of a single undifferentiated CTA.

Everything explicitly rejected is listed in §5, with the reason. Do not
reintroduce any of it based on the reference image alone — if you find
yourself copying the Team section or the fake-success booking modal,
stop.

---

## 1. Sticky anchor tab bar

### 1.1 What it does

A horizontal, sticky row of section labels below the header, letting the
user jump directly to a section instead of scrolling the full page.
Highlights the section currently in view.

### 1.2 Sections (adjust to what actually renders)

Only include a tab for a section that will actually render given the
provider's data. A `limitedListing` provider currently shows almost none
of the detail sections — do not show tabs for sections that won't exist
on the page for that provider.

For a full (non-limited) listing:
```
Photos · Services · Hours · Nearby
```

For a `limitedListing` provider, the tab bar should not render at all —
there's only the notice block and contact channels, nothing worth
jumping between.

**Do not add "Team" or "Reviews" tabs.** No data exists behind either
(see §5).

### 1.3 Implementation

- Sticky under the existing header, same pattern as the header's own
  positioning.
- Each tab is a `Pressable` that scrolls the main `ScrollView` to the
  y-offset of its section, measured via `onLayout` on each section's
  wrapping `View`.
- Highlight the active tab based on scroll position — track via
  `onScroll` with a throttle, compare against each section's stored
  y-offset, and highlight the last section whose offset is above the
  current scroll position plus a small header-height buffer.
- No new dependency. `ScrollView.scrollTo` and `onLayout` are sufficient
  — do not reach for a tab library or a third-party scroll-spy package for
  three or four tabs.

### 1.4 Acceptance criteria

- Tapping a tab scrolls smoothly to that section.
- Scrolling manually updates the active tab highlight correctly.
- A `limitedListing` provider renders no tab bar.
- A provider with no gallery beyond the cover image (`gallery.length <=
  1`) does not show a "Photos" tab — same "don't render a tab for a
  section that isn't there" rule as Team and Reviews.

---

## 2. Venues nearby

### 2.1 What it does

A horizontal carousel at the bottom of the detail screen showing other
providers, so a user who lands on the wrong listing has somewhere to go
next instead of only "back."

### 2.2 Selection logic

From `catalog.providers`, excluding the current provider:

1. Prefer providers sharing `categoryId` with the current provider.
2. If fewer than 6 same-category matches exist, fill remaining slots with
   providers sharing `area`.
3. Cap at 8. If fewer than 3 candidates exist after both passes, do not
   render the section at all — a "nearby" carousel with one card reads
   as broken, not sparse.

This is a client-side filter over data already in the `useCatalog()`
context. No new endpoint, no new query.

### 2.3 Card

Reuse the existing `ProviderCard` component exactly as it renders
elsewhere in the app (Home, Search) — do not build a fourth card
variant for this one section. If `ProviderCard` does not yet have a
horizontal-carousel-appropriate size, that's tracked separately in the
Phase Zero UI build spec; use whatever variant is closest today rather
than inventing a new one here.

Tapping a card navigates to that provider's detail screen
(`router.push`, not `router.replace` — preserve the back stack so the
user can return to the listing they came from).

### 2.4 Acceptance criteria

- Section is titled "Venues nearby" (not "Nearby venues" — matches the
  established KiliPicks copy voice more directly, but confirm against
  whatever the Home tab titles its own section as, and match it exactly
  so the same concept isn't worded two different ways in one app).
- Section does not render when fewer than 3 candidates exist.
- The current provider never appears in its own nearby list.
- Tapping a card navigates correctly and preserves the back stack.

---

## 3. Service rows deep-link into booking with pre-selection

### 3.1 The problem this solves

`app/booking/[providerId].tsx` already has honest, working service
selection — the user picks a service, sees "date, time and payment are
the next implementation milestone," and that's the correct Phase Zero
state. The gap is upstream: on the detail screen, tapping a specific
service in the Services list does nothing differentiated — the only path
into booking is the single generic CTA at the bottom, which drops the
user into the booking screen with whatever service happens to be first
in the array selected by default.

### 3.2 The fix

Make each service row in the detail screen's Services section tappable
(currently they are static `View`s, not `Pressable`s). Tapping one
navigates to the booking screen with that service's ID passed as a param:

```tsx
router.push({
  pathname: "/booking/[providerId]",
  params: { providerId: provider.id, serviceId: service.id },
});
```

In `app/booking/[providerId].tsx`, read the optional `serviceId` param
and use it to set the initial `serviceId` state instead of always
defaulting to `services[0]?.id`:

```tsx
const { providerId, serviceId: preselectedServiceId } =
  useLocalSearchParams<{ providerId: string; serviceId?: string }>();
// ...
const [serviceId, setServiceId] = useState(
  preselectedServiceId &&
    services.some((s) => s.id === preselectedServiceId)
    ? preselectedServiceId
    : (services[0]?.id ?? ""),
);
```

Validate the incoming `serviceId` actually exists in this provider's
bookable services before trusting it — a stale deep link or a tampered
param should fall back to the existing default, not crash or select
nothing.

### 3.3 Gating

Only make a service row tappable-into-booking if that specific service
has `bookingEnabled === true` **and** the provider overall has
`bookingEnabled === true` and is not `limitedListing`. This mirrors the
existing gating logic in the booking screen itself — don't create a path
that leads to the booking screen only to be told nothing is bookable.

For services where booking isn't enabled, the row stays visually
identical but not interactive, or the price/service info is shown
without a chevron/tap affordance — do not disable the whole Services
section, only the row-level tap behaviour, since the row is still useful
as pricing information (this is the existing "no fake booking dead-ends"
principle applied at row level, not the notice-block level).

### 3.4 Acceptance criteria

- Tapping a bookable service navigates to booking with that service
  pre-selected — verify the correct radio button is selected on landing,
  not the first one in the list.
- Tapping a non-bookable service does nothing (or does not present as
  tappable — visual treatment is a judgment call, but it must not
  navigate anywhere that dead-ends).
- A malformed or stale `serviceId` param falls back to the existing
  default behaviour rather than crashing.
- The existing single "View times & book" / "Booking not available yet"
  CTA at the bottom of the detail screen is unchanged — this is an
  additive shortcut, not a replacement.

---

## 4. Layout changes summary

```
Header (unchanged: back, title, favourite)
Sticky tab bar (NEW — only for non-limited listings with 2+ sections)
  ├─ Photos
  ├─ Services
  ├─ Hours
  └─ Nearby
────────────────────────────────
Cover image (unchanged)
Identity block: badge, name, category, location (unchanged)
Contact channels (unchanged)
[limitedListing notice] OR:
  Positioning text (unchanged)
  Metrics row: rating / verified visits / open-now (unchanged)
  Services — rows now tappable, deep-link with pre-selection (CHANGED)
  Photos gallery (unchanged, now a tab anchor target)
  [Hours — anchor target only; content unchanged, still the single
    openNow-derived line. See §6 for the structured-hours question.]
  Venues nearby (NEW)
  Booking CTA (unchanged)
```

---

## 5. Explicitly rejected from the reference — do not build

| Reference feature | Why not |
|---|---|
| Team / specialists section | `specialistIds` exists in the schema but no professionals array is ever populated. Building this UI ships empty avatar cards. |
| Reviews section + review count next to rating | `rating`, `verifiedCount`, `wouldReturn` exist; none is confirmed to be a review total. Do not label anything "reviews." |
| Live interactive map with pin | Needs a maps SDK, API key, billing, and location permissions. Non-goal for this phase. |
| Booking modal with date/time slot picker ending in "Booking confirmed!" | This is a fabricated success state for a capability (real booking creation) that does not exist. Directly violates the project's standing rule: an unimplemented capability fails loudly or shows an honest "not yet" state — never a fake success. The existing booking screen already gets this right; do not regress it. |
| Share button | Not requested, not scoped here. Raise separately if wanted. |

If a future reference image reintroduces any of these, the same
reasoning applies — check whether the underlying data or backend
capability exists before building the UI for it, not the other way
round.

---

## 6. Open question — not a build task

The reference's day-by-day opening hours list (each day, its hours, the
current day bolded) is visually the strongest single element in the
mockup. It is **not buildable now**: `businesses.hours` in the backend
PRD is a single free-text string, not structured per-day data, and the
current `openNow` boolean is all the detail screen can honestly show.

Do not attempt to parse the free-text `hours` string into a day-by-day
display — real-world formats vary too much and a wrong parse shows a
business as open when it's closed, which is the one direction of error
the existing `computeOpenNow` logic explicitly guards against.

**Raise with the product owner:** should the backend schema change to
structured per-day hours (e.g. `{ mon: {open, close}, tue: {...}, ... }`
as JSON)? If yes, this becomes a backend PRD addition, and the detail
screen's Hours section gets rebuilt once that data exists. Not a task for
this pass.

---

## 7. Commit sequence

1. `feat: add sticky anchor tab bar to the provider detail screen`
2. `feat: add the venues-nearby carousel to the provider detail screen`
3. `feat: make service rows deep-link into booking with pre-selection`

Each commit is independently shippable — none depends on the others.
Order is by visual prominence, not dependency.
