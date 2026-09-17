# Seller Dashboard Implementation — Bookings, Sales, Looks, Inbox, Profile

**Status:** Complete, verified, not yet committed/pushed.
**Built against:** `merchant_prd.md` §5 (seller dashboard spec) and the 5
mockups in `Inspo/` (`code boking agenda.html`, `code sales performance.html`,
`code merchant looks visual portfolio growth.html`, `code merchant inbox.html`,
`code merchant profile business control centre.html`).
**Supersedes:** the "Bookings/Sales/Looks/Inbox: 100% unbuilt" and "Profile
fakes its own bottom bar" findings in `project_status_audit.md` §3/§4 — those
are now closed.

---

## 1. What this delivers

A real 5-tab seller dashboard (`Bookings`, `Sales`, `Looks`, `Inbox`,
`Profile`) at `app/merchant/(dashboard)/`, replacing the old single
`profile.tsx` screen that hand-rolled its own non-functional bottom bar.

Per explicit instruction, this pass is **frontend-only**: Bookings, Sales,
and Looks use local/mock data (matching the PRD's own "local-only in Phase
Zero" language for those entities — see §6 below). **Profile is the
exception** — it keeps using the real merchant APIs built in an earlier
session pass (`fetchMerchantBusiness`, `fetchMerchantServices`,
`updateMerchantService`), since mocking data that's already real would be a
regression, not a simplification.

---

## 2. Real vs. mock, screen by screen

Read this table before touching any of these screens — it's the difference
between "safe to demo" and "will mislead someone into thinking there's a
backend that doesn't exist."

| Screen | Data source | Notes |
|---|---|---|
| **Profile** | **Real** — `fetchMerchantBusiness`, `fetchMerchantServices`, `updateMerchantService`, `updateMerchantBusiness`, real `signOut` | Only screen wired to the actual backend. "Staff & Team Members" from the mockup was **dropped** — PRD §2 lists staff accounts as a non-goal, so it's not shown with invented "3 stylists active" data. |
| **Bookings** | **Local**, AsyncStorage (`kilipicks.merchant.bookings.v1`) | Matches PRD §6: "Booking... Local only in Phase Zero." Service picker in the "New Booking" form *is* real (`fetchMerchantServices`) — only the booking records themselves are local. |
| **Sales** | **Local**, AsyncStorage (`kilipicks.merchant.sales.v1`) | Matches PRD §5.2: "All sales data is local to the device." Deliberately drops the mockup's "+18% vs last month" delta and "top 15% of Nairobi studios" claim — a fresh local store has no prior-month data and no basis for a ranking claim. Don't add these back without a real data source. |
| **Looks** | **Mock**, local component state only, not persisted | No backend exists for Looks at all (no routes; the `looks` table is unused). "Boost" and "Create Look" are both "coming soon" sheets rather than the mockup's simulated M-Pesa charge / an invented 3-step upload wizard that no mockup ever specified. |
| **Inbox** | **Mixed** — Chats/Activity are mock content; Support is real | No chat/event backend exists, so Chats and Activity are illustrative. Support is wired to the real `SUPPORT_WHATSAPP_NUMBER` (`@/config/env`) using the same availability-gating pattern `app/(tabs)/account.tsx` already has — shows "Support coming soon" if that env var is unset. |

**If you're adding a real backend for Bookings, Sales, or Looks later:**
the local contexts (`src/merchant/bookings-context.tsx`,
`src/merchant/sales-context.tsx`) are intentionally shaped close to what a
real API response would look like (see PRD §6's `Booking`/`Transaction`
entity fields) specifically to make that swap easier — replace the
AsyncStorage load/persist effects with real fetch/mutate calls, keep the
same context shape, and the 5 screens shouldn't need to change.

---

## 3. New files

```
app/merchant/(dashboard)/_layout.tsx     — the real <Tabs> navigator
app/merchant/(dashboard)/bookings.tsx
app/merchant/(dashboard)/sales.tsx
app/merchant/(dashboard)/looks.tsx
app/merchant/(dashboard)/inbox.tsx
app/merchant/(dashboard)/profile.tsx     — rebuilt (old app/merchant/profile.tsx deleted)

src/merchant/business-context.tsx        — one shared business fetch for the whole dashboard
src/merchant/bookings-context.tsx        — local booking store (AsyncStorage)
src/merchant/sales-context.tsx           — local transaction/goals store (AsyncStorage)

src/components/merchant/DashboardHeader.tsx — shared header (all 5 screens)
src/utils/whatsapp.ts                    — shared openWhatsapp() helper
```

**Changed:**
- `src/theme/merchant.ts` — `mc` palette updated to match the new mockups'
  Material-3 tokens (same key names, new hex values — see §4). Added
  `mr['2xl'] = 24`.
- `app/merchant/_layout.tsx` — now wraps `(dashboard)` instead of `profile`
  directly.
- `package.json` — added `@expo/vector-icons@^15.1.1` (new dependency, first
  use in this codebase — every icon on these 5 screens is `MaterialIcons`,
  not emoji).

---

## 4. Architecture decisions (and why)

**Route group, not a new stack.** `app/merchant/(dashboard)/` is an Expo
Router route group — invisible in the URL. `/merchant/profile` and
`/merchant/services` still resolve exactly as before; every existing
`router.push("/merchant/profile")` call site (`account.tsx`,
`onboard/submitted.tsx`) needed zero changes. `services.tsx` deliberately
stays *outside* the group, at the top level — it's pushed as a stack screen
from Profile, not a tab of its own.

**Theme palette refresh, not a new system.** The new mockups' Tailwind
config uses the exact same Material-3 token names `mc` already had
(`primary`, `primaryFixed`, `surfaceContainerLowest`, `outlineVariant`, ...).
Updating the hex *values* in place means every existing merchant screen
(onboarding, Services) re-skinned automatically with zero call-site changes.
If a future design pass needs the *old* rust palette back, it's a one-file
diff in `src/theme/merchant.ts`.

**WhatsApp links use the native scheme, not the mockups' `wa.me` links.**
`whatsapp://send?phone=...`, `canOpenURL`-checked before opening — matches
the pattern already established in `app/(tabs)/account.tsx` and
`src/utils/contact-links.ts`. Extracted into `src/utils/whatsapp.ts` since
both Bookings and Inbox needed it.

**No `react-native-svg` added.** The Sales weekly bar chart is 4 plain
`View`s sized by percentage height, with `expo-linear-gradient` (already a
dependency) on the highlighted peak bar. Didn't need a charting library for
4 static bars.

**Honesty over fidelity, where they conflicted.** A few places deliberately
depart from what the mockups show:
- Sales: no fabricated month-over-month delta or industry-ranking claim.
- Looks: Boost/Create Look are "coming soon," not a fake payment flow.
- Profile: no "Staff & Team Members" row with invented headcount.

This isn't a style preference — it's the standing rule already enforced
elsewhere in this codebase (see `Home_upgrade.MD` §5, which rejected a fake
"Booking confirmed!" modal on the same grounds).

---

## 5. Verification performed

- `npx tsc --noEmit` — 0 errors.
- `npx eslint .` — 0 errors on every new/changed file (only the pre-existing
  `set-state-in-effect` warning pattern already present throughout the repo).
- `npx expo export --platform web` — bundles cleanly, all 18
  `@expo/vector-icons` font families present in the output (confirms icons
  are actually wired up, not just imported and silently broken).
- Not yet manually driven on a device/simulator — no Android/iOS runtime
  available in this environment. **Before shipping:** run through Bookings'
  New Booking flow and Sales' Add Transaction flow on a real device once, to
  confirm AsyncStorage persistence round-trips (survives an app restart),
  not just that it compiles.

---

## 6. Known follow-ups (not done in this pass)

- **Availability controls** (PRD §5.1) — the "Manage availability" button on
  Bookings is present but inert (no backend, no local model). Matches the
  PRD's own scoping; not a bug.
- **Create Look flow** — no mockup was ever provided for the 3-step
  wizard PRD §5.3.1 describes, so it wasn't built. Currently a "coming soon"
  sheet.
- **Sales period bucketing** — the Daily/Weekly/Monthly segmented control is
  currently a visual toggle only; all three periods read the same
  transaction list. Real per-period bucketing needs actual historical data,
  which doesn't exist yet on a fresh local store.
- **Mode persistence** (PRD §8) — switching into/out of seller mode still
  isn't persisted to AsyncStorage across cold starts. Unrelated to this pass;
  still open from the original audit.
