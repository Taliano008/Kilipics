# KiliPicks — Merchant Seller Mode PRD

**Document type:** Product Requirements Document
**Feature:** "Switch to Seller" — merchant onboarding and seller dashboard
**Consumer app baseline:** Phase Zero MVP (d71e196)
**Reference:** GlamBack Merchant App structure
**Owner:** Daniel Mathenge / KiliMax
**Status:** Draft for engineering review

---

## 1. What this is

A second mode inside the KiliPicks app, accessible to any consumer via a
"Switch to seller" button on the home view. Tapping it initiates a four-step
merchant onboarding flow, then drops the merchant into a dedicated seller
dashboard with five tabs: Bookings, Sales, Looks, Inbox, and Profile.

This is a single app with two modes — not two apps. The switch is
reversible. A merchant can go back to the consumer view at any time.

---

## 2. Non-goals for this phase

Do not build any of the following. Their absence is deliberate:

- Real payment processing or M-Pesa disbursement
- Automated booking confirmation (bookings are manually managed)
- Push notifications
- Subscription billing or payment for the upgrade banner
- Customer-facing reviews or ratings submission
- Staff / team member accounts
- Analytics beyond the Sales tab's manual entry model

---

## 3. Entry point

### 3.1 "Switch to seller" button

**Location:** Top-right of the consumer Home tab header.

**Label:** "Switch to seller"

**Behaviour:**
- If the user has never completed merchant onboarding → begin the onboarding
  flow (§4).
- If the user has a completed merchant account → go directly to the seller
  dashboard (§5).
- If the user is not logged in → open the auth modal first, then redirect to
  onboarding on success.

**Visual:** A small pill button, secondary style, consistent with the existing
header. Does not compete with the primary consumer search entry point.

**Acceptance criteria:**
- Button is visible on Home without scrolling.
- A logged-out user who taps it completes auth then lands in onboarding, not
  back on Home.
- A returning merchant who taps it lands directly in the seller dashboard.

---

## 4. Merchant onboarding flow

Four steps, one screen each. Progress is shown as a step indicator (1 of 4,
2 of 4, etc.) at the top of each screen. Partial progress is saved after each
completed step so a merchant who closes the app mid-flow can resume.

### Step 1 — Personal details

**Fields:**
- Full name (required)
- Email address (required, validated format)
- Phone number (required, Kenyan format, reuses `normalizeKenyanPhone` from
  `src/utils/phone.ts`)

**Notes:**
- If the user is already logged in via the consumer auth flow, pre-fill any
  fields already known. Do not ask for information you have.
- Password is not required here if the auth model uses OTP. Align with
  whatever auth provider is chosen for the consumer app.

**Validation:** All three fields must pass before the Next button is enabled.
Phone must validate via `normalizeKenyanPhone`. Email must match a basic
format regex.

**Acceptance criteria:**
- Invalid email disables Next and shows an inline error.
- A phone number in local format (0712...) is accepted and stored as +254712...
- Pre-fill works when the user arrived from a logged-in consumer session.

---

### Step 2 — Business details

**Fields:**
- Business name (required)
- Business email (required, may differ from personal email)
- Category (required, single-select from the KiliPicks category list — same
  source as `src/utils/categories.ts`, not a hardcoded list)
- Business phone number (required, may differ from personal number)

**Notes:**
- Category selection opens a scrollable sheet, not a dropdown. Categories are
  derived from the live catalog, same as the consumer Home grid.
- A business may eventually have a subcategory, but do not add that field now
  — it adds friction and the data model does not require it at signup.

**Acceptance criteria:**
- Category sheet shows the same categories as the consumer app.
- Selecting a category closes the sheet and populates the field.
- All four fields must be valid before Next is enabled.

---

### Step 3 — Location

**Fields:**
- Address (required, free text)
- Neighbourhood / area (required, free text — maps to `provider.area`)
- GPS coordinates (required, via device location OR manual pin)

**Behaviour:**
- Show a "Use my current location" button that requests location permission and
  fills the GPS fields and attempts to reverse-geocode a street address.
- Also allow manual entry of the address with a map pin confirmation.
- If location permission is denied, manual entry is the fallback — do not
  block progress.
- Store `latitude`, `longitude`, `fullAddress`, and `area` to match the
  existing `providerLocationSchema`.

**Privacy:** Location permission request must explain clearly why it is needed
("So customers can find your business"). Do not request location permission
before this step.

**Acceptance criteria:**
- "Use my current location" populates address fields within 3 seconds on a
  mid-tier Android device.
- Denied permission does not block step completion via manual entry.
- Stored coordinates round-trip through the catalog schema without loss.

---

### Step 4 — Business images and final details

Three sub-sections on one screen, each collapsible. All are optional at
signup — the merchant can add them now or later from the Profile tab.

**Sub-section A — Photos**
- Cover photo (1 image, required for publishing — optional at signup)
- Gallery (up to 8 images)
- Client-side compression before upload. Target: each image ≤ 400KB after
  compression. Use `expo-image-manipulator`.
- Explicit rights confirmation checkbox: "I own or have the right to use
  these images." Must be checked before any image is submitted.

**Sub-section B — Opening hours**
- Seven-day schedule. Each day: open/closed toggle, open time, close time.
- "Same hours every day" shortcut.

**Sub-section C — Brief description**
- Free text, max 280 characters. Character counter shown.
- Maps to `provider.positioning`.

**Completion:**
- "Finish setup" button publishes the listing as `publicationStatus: draft`
  and `limitedListing: true` until the team reviews and publishes it.
- Show a confirmation screen: "Your business is being reviewed. We'll notify
  you by WhatsApp once it's live. You can complete your profile in the
  meantime."
- Navigate to the seller dashboard (§5).

**Acceptance criteria:**
- A merchant can complete step 4 with no images and still finish onboarding.
- The rights checkbox must be checked to submit any image — the submit button
  is disabled otherwise.
- Compressed images are visually acceptable at their reduced size.
- Confirmation screen shows before entering the dashboard.

---

## 5. Seller dashboard

Five-tab bottom navigation. Tab order: Bookings, Sales, Looks, Inbox, Profile.

A persistent header above the tab bar shows the business name and a
"Switch to consumer view" link — mirroring the entry point.

---

### 5.1 Bookings tab (`/seller/bookings`)

**Purpose:** Manual appointment management. There is no automated booking
system in this phase.

**Views:**

*Calendar / agenda view (default)*
- Monthly calendar with dots indicating days that have bookings.
- Tapping a day shows an agenda list for that day.
- Each booking card: customer name, service, time, duration, status
  (Confirmed / Pending / Cancelled).

*Create manual booking*
- Accessible via a "+" FAB.
- Fields: customer name, customer phone, service (select from the merchant's
  service catalog), date, time, duration, notes.
- No payment capture in this flow.

*Availability controls*
- A separate view within this tab (not a tab of its own).
- Merchant sets available days and hours per week.
- "Block time" — mark specific slots as unavailable (holidays, breaks).
- This data feeds `availability` in the catalog snapshot once the backend
  supports it.

**Acceptance criteria:**
- A manually created booking appears on the calendar on the correct date.
- Availability blocks are saved and reflected on the calendar.
- No booking is created without a customer name, service, and time.

---

### 5.2 Sales tab (`/seller/sales`)

**Purpose:** Simple income tracking. Manual entry only — no payment
integration.

**Views:**

*Overview*
- Income vs. expenses for the current month. Two large numbers, a simple
  bar or line chart below.
- Toggle between daily, weekly, and monthly views.

*Goal tracker*
- Daily target (editable). Progress bar showing today's bookings value vs.
  target.
- Weekly target. Progress bar.

*Transaction log*
- Chronological list of transactions.
- Each row: date, description, amount, type (income / expense).
- "Add transaction" button → modal with: type, amount, description, date.

**Data model note:** All sales data is local to the device in Phase Zero.
There is no server-side financial data. Make this explicit in the UI
("Your data is stored on this device").

**Acceptance criteria:**
- Adding a transaction updates the overview totals immediately.
- Goals persist across app restarts.
- The "stored on this device" notice is visible.

---

### 5.3 Looks tab (`/seller/looks`)

**Purpose:** A portfolio feed of the merchant's work — shoppable posts that
link to services.

**Portfolio feed (default view)**
- Grid of looks (2 columns). Each cell: cover image, service tag, brief
  description preview.
- Tapping a look opens a detail view: full image(s), description, linked
  service with price, "Book this service" CTA.
- "Boost" button on each look (see §5.3.2).

**5.3.1 Create look flow (`/seller/looks/create`)**

*Step 1 — Media*
- Upload up to 3 photos OR 1 video. Not both in the same look.
- Client-side compression for photos. Video capped at 60 seconds.
- Rights confirmation checkbox (same as onboarding §4).

*Step 2 — Details*
- Category pills: Hairstyles, Nails, Skin, Brows & Lashes, Makeup, Spa,
  Barbering. Multi-select.
- Link a service from the merchant's service catalog. If no services exist,
  show an empty state with a "Add a service first" CTA linking to Profile →
  Service catalog. The look can be saved without a linked service, but
  the "Book this service" CTA will not render until one is linked.
- Description: free text, max 100 characters. Character counter.
- Keyword tags: free text, max 5 tags, comma or enter to add, deletable pills.

*Step 3 — Review and publish*
- Preview of the look as it will appear in the feed.
- "Publish" or "Save as draft".

**5.3.2 Boost look**
- A "Boost" button on each published look.
- In Phase Zero: tapping Boost opens a "Coming soon" sheet explaining that
  promoted placement is launching soon. Do not build payment or promotion
  logic.

**Acceptance criteria:**
- A look with 3 photos and no linked service publishes successfully.
- A look with a linked service shows the "Book this service" CTA in the
  detail view.
- Category pills are multi-selectable.
- Description enforces the 100-character limit with a visible counter.
- Tags beyond 5 cannot be added — the input is disabled after 5.
- Boost shows the "coming soon" sheet in Phase Zero.

---

### 5.4 Inbox tab (`/seller/inbox`)

**Purpose:** Customer communication hub.

**Three sections (horizontally scrollable tab bar within the tab):**

*Chats*
- List of active customer conversations.
- Each row: customer name/number, last message preview, timestamp, unread
  count badge.
- Tapping opens the conversation. In Phase Zero, this is a WhatsApp deep
  link (`whatsapp://send?phone=...`) rather than an in-app chat, since
  there is no messaging backend.
- Show a clear label: "Continue on WhatsApp" so the transition is not
  surprising.

*Activity*
- Feed of merchant-relevant events: new booking, booking cancelled, new
  follower (when follower model exists), look liked.
- In Phase Zero: empty state with "Activity from customers will appear here."

*Support*
- A single "Chat with KiliPicks support" button opening a WhatsApp
  conversation with the support number (from §5.3 of the Phase Zero PRD).
- A brief FAQ list below it covering the most common merchant questions
  (hardcoded in Phase Zero).

**Acceptance criteria:**
- Tapping a chat opens WhatsApp with the customer's number pre-filled.
- The "Continue on WhatsApp" label is shown before the deep link fires.
- Support button opens the KiliPicks WhatsApp support number.

---

### 5.5 Profile tab (`/seller/profile`)

**Purpose:** Business identity, service catalog, and account settings.

**Sections:**

*Business header*
- Cover photo, business name, category, area.
- Follower count and following count (both 0 in Phase Zero — show the
  fields, grey them out, add "Followers coming soon" tooltip).
- "Edit profile" button → opens the business details form from onboarding
  step 2, pre-filled.

*Subscription / upgrade banner*
- Persistent banner at the top of the Profile tab (not a modal, not a
  full-screen takeover).
- "Upgrade to Pro — get featured placement and verified badge."
- In Phase Zero: tapping opens a "Coming soon" sheet. Do not build
  subscription logic.

*Service catalog*
- List of the merchant's services. Each row: service name, duration, price,
  active/inactive toggle.
- "Add service" → modal with: name, category, description, price (and price
  type: fixed / from / range / contact for price), duration in minutes,
  optional photo.
- Edit and delete per service.
- Services feed into the Looks "link a service" flow (§5.3.1) and
  eventually into the consumer-facing provider detail screen.

*Account actions*
- Switch to consumer view
- Edit personal details (name, email, phone from onboarding step 1)
- Privacy notice link
- Sign out

**Acceptance criteria:**
- A service added in the catalog is immediately available in the Looks
  "link a service" picker.
- Active/inactive toggle persists across app restarts.
- Upgrade banner is visible without scrolling on a standard Android screen.
- Follower counts show 0 with the "coming soon" label, not a blank space.

---

## 6. Data model extensions

The existing `publicCatalogProviderSchema` in `src/schemas/catalog.ts` covers
most of what a merchant listing needs. Extensions required for the seller
dashboard that do not exist yet:

| Entity | Fields | Notes |
|---|---|---|
| `Merchant` | `userId`, `businessId`, `createdAt` | Links a user account to a business |
| `Booking` | `id`, `merchantId`, `customerName`, `customerPhone`, `serviceId`, `date`, `time`, `durationMinutes`, `status`, `notes` | Local only in Phase Zero |
| `Transaction` | `id`, `merchantId`, `type`, `amount`, `description`, `date` | Local only in Phase Zero |
| `Look` | `id`, `merchantId`, `mediaUrls`, `mediaType`, `categories`, `serviceId`, `description`, `tags`, `status`, `createdAt` | Stored server-side |
| `Service` | Already exists as `PublicCatalogService` | Add `merchantId` ownership field |
| `Availability` | Already exists as `PublicCatalogAvailability` | Extend with merchant-set blocks |

Booking and Transaction data is local-only in Phase Zero. The schema must be
designed to migrate server-side in Phase One without breaking existing records
— use the same ID format as server entities (`id` string, no auto-increment).

---

## 7. Auth dependency

This entire feature depends on the auth boundary defined in
`KiliPicks-Auth-And-Onboarding-Spec.md` §4. The seller dashboard must never
be reachable without an authenticated session. The Phase Zero implementation
of auth returns `status: "unavailable"` — which means the seller dashboard
is also unavailable until real auth is wired.

**Do not build the seller dashboard without the auth boundary in place.**
Build the auth boundary first (per the auth spec commit sequence), then layer
the seller mode on top.

---

## 8. Mode switching

The consumer and seller views are two modes of one app.

- Consumer home header: "Switch to seller" pill (§3.1).
- Seller dashboard header: "Switch to consumer view" link.
- Switching modes does not sign the user out.
- Switching modes does not reset any navigation state in the destination mode.
- The active mode is persisted to `AsyncStorage` so the app opens in the
  last-used mode.

**Acceptance criteria:**
- Switching from consumer to seller and back preserves the consumer tab
  position.
- A cold start opens in the last-used mode.
- Mode switching takes < 300ms (no full re-render of the root navigator).

---

## 9. Analytics events to add

Extend the `EventName` union in `src/analytics/events.ts` with:

```
"seller_mode_entered"
"merchant_onboarding_step_completed"   // properties: step (1-4)
"merchant_onboarding_completed"
"look_created"
"look_boosted_tapped"                  // Phase Zero: tracks intent even though boost is unavailable
"booking_created"
"transaction_added"
"service_added"
"upgrade_banner_tapped"               // Phase Zero: tracks intent
```

Confirm the analytics ingest endpoint accepts these event names before
adding them — or add them and note they will be silently ignored until the
backend schema is updated.

---

## 10. Open questions before build starts

Answer these before committing to a schedule:

1. **Auth timeline.** The seller dashboard is inert until real auth exists.
   When is auth expected from the backend workstream?
2. **Service catalog ownership.** Currently `PublicCatalogService` has a
   `providerId` but no concept of a logged-in merchant owning it. How does
   the backend associate a service with an authenticated merchant?
3. **Look storage.** Looks contain media — where does it go? R2 is the
   natural answer given the existing setup, but upload endpoints do not exist.
4. **Booking and transaction local-only model.** Acceptable for Phase Zero,
   but what triggers the migration to server-side? A merchant switching
   devices will lose all data. Make this risk visible to the product owner
   before shipping.
5. **Support number.** The Inbox support button and the consumer Account tab
   both need a real WhatsApp number. Is it the same number?
6. **Category pills in Create Look.** The spec lists hardcoded categories
   (Hairstyles, Nails, etc.). Should these derive from the catalog like the
   consumer category grid, or is this a separate look-specific taxonomy?

---

## 11. Commit sequence

In dependency order:

1. Auth boundary (from `KiliPicks-Auth-And-Onboarding-Spec.md` — must exist first)
2. `feat: add mode switching and the Switch to Seller entry point`
3. `feat: merchant onboarding step 1 — personal details`
4. `feat: merchant onboarding step 2 — business details`
5. `feat: merchant onboarding step 3 — location with GPS`
6. `feat: merchant onboarding step 4 — images, hours, description`
7. `feat: seller dashboard shell with five-tab navigation`
8. `feat: bookings tab — calendar, agenda view, create booking`
9. `feat: bookings tab — availability controls`
10. `feat: sales tab — overview, goal tracker, transaction log`
11. `feat: looks tab — portfolio feed and create look flow`
12. `feat: inbox tab — chats (WhatsApp), activity empty state, support`
13. `feat: profile tab — business header, service catalog, upgrade banner`
14. `docs: update ARCHITECTURE.md with seller mode and data model extensions`

Each commit must leave the consumer app fully functional. The seller mode is
additive — it must never break the consumer flow.