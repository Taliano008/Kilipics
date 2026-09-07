# KiliPicks — Backend PRD (Phase Zero)

**Document type:** Backend engineering specification
**Runtime:** Node.js + Fastify
**Database:** MySQL 8 (local)
**File storage:** Local filesystem (cloud migration deferred)
**Admin panel:** AdminJS embedded in the Fastify server
**Auth:** Email + password (no OTP, no third-party SMS, no email provider)
**Scope:** Phase Zero only. Nothing in this document is a stub for Phase One.
**Owner:** Daniel Mathenge / KiliMax
**Status:** Ready for implementation

---

## 0. Ground rules

1. **Local first.** Everything in this document runs on a single developer
   machine with MySQL installed. No cloud accounts, no external services,
   no API keys required to start the server.
2. **Separate tables for consumers and merchants.** A `users` table exists
   for consumers (Phase One login) and a `merchants` table for business
   owners. They do not share a row, a role field, or an auth system.
3. **Consumer login is Phase One.** The `users` table is created now so
   the schema is ready. No login endpoints are built for consumers in this
   phase.
4. **No OTP. No SMS provider. No email provider.** Auth is email +
   password. Password reset is done manually by the team via the admin
   panel.
5. **Admin access is via hardcoded env variables.** No admin signup flow.
6. **Phase Zero scope is fixed.** Do not build, scaffold, or stub anything
   not listed in this document.
7. Work through sections in order. Schema before routes. Routes before
   admin panel. Admin panel before the catalog snapshot.

---

## 1. Project structure

```
kilipicks-server/
├── src/
│   ├── db/
│   │   ├── connection.js        ← MySQL pool setup
│   │   └── migrations/          ← numbered SQL files
│   │       ├── 001_users.sql
│   │       ├── 002_merchants.sql
│   │       ├── 003_businesses.sql
│   │       ├── 004_services.sql
│   │       ├── 005_availability.sql
│   │       ├── 006_bookings.sql
│   │       ├── 007_looks.sql
│   │       ├── 008_media.sql
│   │       └── 009_analytics_events.sql
│   ├── routes/
│   │   ├── public/
│   │   │   └── catalog.js       ← GET /api/public/catalog
│   │   ├── auth/
│   │   │   └── merchant.js      ← signup, login, signout, me
│   │   ├── merchant/
│   │   │   ├── business.js
│   │   │   ├── services.js
│   │   │   ├── bookings.js
│   │   │   ├── availability.js
│   │   │   ├── looks.js
│   │   │   └── media.js
│   │   └── analytics/
│   │       └── events.js        ← POST /api/analytics/events
│   ├── services/
│   │   ├── auth.js              ← password hashing, token logic
│   │   ├── catalog.js           ← snapshot builder
│   │   └── media.js             ← file handling
│   ├── middleware/
│   │   ├── merchant-auth.js     ← bearer token verification
│   │   └── admin-auth.js        ← env-var admin verification
│   ├── admin/
│   │   └── index.js             ← AdminJS setup
│   └── app.js                   ← Fastify instance, plugin registration
├── uploads/                     ← local file storage (gitignored)
│   ├── covers/
│   ├── gallery/
│   ├── looks/
│   └── services/
├── migrations.js                ← migration runner script
├── .env.example
├── .env                         ← gitignored
└── package.json
```

---

## 2. Environment variables

```bash
# .env.example

# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kilipicks
DB_USER=root
DB_PASSWORD=

# Auth
JWT_SECRET=change-this-to-a-long-random-string-before-any-real-use
JWT_EXPIRES_IN=90d

# Admin panel
ADMIN_EMAIL=admin@kilipicks.com
ADMIN_PASSWORD=change-this-before-use

# Analytics
ANALYTICS_APP_TOKEN=change-this-to-a-long-random-string

# File storage
UPLOADS_DIR=./uploads
UPLOADS_BASE_URL=http://localhost:3000/uploads
```

The admin panel login checks `ADMIN_EMAIL` and `ADMIN_PASSWORD` directly
from env. No admin row in the database. No admin signup endpoint.

---

## 3. Database schema

Run `node migrations.js` to apply all migrations in order. Migrations are
idempotent — a file already applied is skipped, never re-run.

### 3.1 Users (consumers — Phase One login)

```sql
-- 001_users.sql
CREATE TABLE IF NOT EXISTS users (
  id           CHAR(26) PRIMARY KEY,        -- ULID, generated in app code
  email        VARCHAR(255) UNIQUE NOT NULL,
  phone        VARCHAR(20),
  full_name    VARCHAR(255),
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                 ON UPDATE CURRENT_TIMESTAMP(3)
);
```

**No login endpoints are built for users in Phase Zero.** This table exists
so the schema is ready for Phase One without a destructive migration.

### 3.2 Merchants

```sql
-- 002_merchants.sql
CREATE TABLE IF NOT EXISTS merchants (
  id              CHAR(26) PRIMARY KEY,     -- ULID
  full_name       VARCHAR(255) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,    -- bcrypt, cost 12
  status          ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                    ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS merchants_email_idx ON merchants (email);
```

### 3.3 Merchant auth tokens

```sql
-- (append to 002_merchants.sql)
CREATE TABLE IF NOT EXISTS merchant_tokens (
  id           CHAR(26) PRIMARY KEY,
  merchant_id  CHAR(26) NOT NULL,
  token_hash   VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hex of the raw token
  expires_at   DATETIME(3) NOT NULL,
  last_used_at DATETIME(3),
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS merchant_tokens_merchant_idx
  ON merchant_tokens (merchant_id);
```

### 3.4 Businesses

```sql
-- 003_businesses.sql
CREATE TABLE IF NOT EXISTS businesses (
  id                  CHAR(26) PRIMARY KEY,
  merchant_id         CHAR(26) NOT NULL,
  slug                VARCHAR(255) UNIQUE NOT NULL,
  name                VARCHAR(255) NOT NULL,
  industry            ENUM('beauty','wellness') NOT NULL,
  category_id         VARCHAR(100) NOT NULL,
  subcategory         VARCHAR(100),
  email               VARCHAR(255),
  phone               VARCHAR(20) NOT NULL,
  area                VARCHAR(255) NOT NULL,
  full_address        TEXT NOT NULL,
  latitude            DOUBLE NOT NULL,
  longitude           DOUBLE NOT NULL,
  location_type       ENUM('FIXED_VENUE','MOBILE_SERVICE','BOTH')
                        NOT NULL DEFAULT 'FIXED_VENUE',
  service_areas       JSON NOT NULL DEFAULT ('[]'),
  landmark            VARCHAR(255) NOT NULL DEFAULT '',
  parking_available   TINYINT(1) NOT NULL DEFAULT 0,
  hours               TEXT NOT NULL DEFAULT '',
  highlights          JSON NOT NULL DEFAULT ('[]'),
  facilities          JSON NOT NULL DEFAULT ('[]'),
  main_offering       VARCHAR(255) NOT NULL DEFAULT '',
  positioning         TEXT,
  starting_price      INT UNSIGNED,            -- KES, whole numbers only
  rating              DECIMAL(3,2),
  verified_count      INT UNSIGNED NOT NULL DEFAULT 0,
  would_return        DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  trust_metric        VARCHAR(255) NOT NULL DEFAULT '',
  verified            TINYINT(1) NOT NULL DEFAULT 0,
  recommended         TINYINT(1) NOT NULL DEFAULT 0,
  featured            TINYINT(1) NOT NULL DEFAULT 0,
  booking_enabled     TINYINT(1) NOT NULL DEFAULT 0,
  booking_method      ENUM('kilipicks','whatsapp','phone','external','disabled')
                        NOT NULL DEFAULT 'disabled',
  partnership_status  ENUM('signed','unsigned') NOT NULL DEFAULT 'unsigned',
  publication_status  ENUM('draft','published','hidden','archived')
                        NOT NULL DEFAULT 'draft',
  limited_listing     TINYINT(1) NOT NULL DEFAULT 1,
  cover_url           TEXT,
  gallery_urls        JSON NOT NULL DEFAULT ('[]'),
  public_contacts     JSON NOT NULL DEFAULT ('{}'),
  payment_settings    JSON NOT NULL DEFAULT ('{}'),
  next_available      VARCHAR(100),
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS businesses_merchant_idx
  ON businesses (merchant_id);
CREATE INDEX IF NOT EXISTS businesses_status_idx
  ON businesses (publication_status, limited_listing);
CREATE INDEX IF NOT EXISTS businesses_category_idx
  ON businesses (category_id);
```

**Notes:**
- One merchant may own one business in Phase Zero. Enforce in app code,
  not a database constraint — a constraint makes Phase One harder.
- `starting_price` is whole KES. No decimals in Kenyan shillings.
- `JSON` columns for arrays — MySQL 8 supports JSON natively.
- `cover_url` and `gallery_urls` store local file paths in Phase Zero,
  CDN URLs in production after the R2 migration.
- `open_now` is NOT stored. It is computed at snapshot build time from
  `hours` and the current Nairobi time (UTC+3).

### 3.5 Services

```sql
-- 004_services.sql
CREATE TABLE IF NOT EXISTS services (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL,
  category_id      VARCHAR(100) NOT NULL,
  industry         ENUM('beauty','wellness') NOT NULL,
  name             VARCHAR(255) NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  price            INT UNSIGNED NOT NULL,       -- KES
  maximum_price    INT UNSIGNED,                -- KES, for range type
  price_type       ENUM('fixed','from','range','contact_for_price')
                     NOT NULL DEFAULT 'fixed',
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  booking_enabled  TINYINT(1) NOT NULL DEFAULT 0,
  active           TINYINT(1) NOT NULL DEFAULT 1,
  image_url        TEXT,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                     ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS services_business_idx
  ON services (business_id, active);
```

### 3.6 Availability

```sql
-- 005_availability.sql
CREATE TABLE IF NOT EXISTS availability (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL,
  service_id       CHAR(26) NOT NULL,
  professional_id  VARCHAR(100) NOT NULL DEFAULT 'default',
  date             DATE NOT NULL,
  time             TIME NOT NULL,
  end_time         TIME,
  available_slots  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE CASCADE,
  UNIQUE KEY availability_slot_uk
    (business_id, service_id, professional_id, date, time)
);

CREATE INDEX IF NOT EXISTS availability_business_date_idx
  ON availability (business_id, date);
```

**Retention:** A nightly job deletes rows where `date < CURDATE() - 7`.

### 3.7 Bookings

```sql
-- 006_bookings.sql
CREATE TABLE IF NOT EXISTS bookings (
  id               CHAR(26) PRIMARY KEY,
  business_id      CHAR(26) NOT NULL,
  service_id       CHAR(26),
  customer_name    VARCHAR(255) NOT NULL,
  customer_phone   VARCHAR(20) NOT NULL,
  date             DATE NOT NULL,
  time             TIME NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  status           ENUM('pending','confirmed','cancelled','completed')
                     NOT NULL DEFAULT 'pending',
  notes            TEXT,
  source           ENUM('manual','app') NOT NULL DEFAULT 'manual',
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                     ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS bookings_business_date_idx
  ON bookings (business_id, date);
```

### 3.8 Looks

```sql
-- 007_looks.sql
CREATE TABLE IF NOT EXISTS looks (
  id           CHAR(26) PRIMARY KEY,
  business_id  CHAR(26) NOT NULL,
  media_urls   JSON NOT NULL,
  media_type   ENUM('photos','video') NOT NULL,
  categories   JSON NOT NULL DEFAULT ('[]'),
  service_id   CHAR(26),
  description  VARCHAR(100) NOT NULL DEFAULT '',
  tags         JSON NOT NULL DEFAULT ('[]'),
  status       ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                 ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS looks_business_idx
  ON looks (business_id, status);
```

### 3.9 Media uploads

```sql
-- 008_media.sql
CREATE TABLE IF NOT EXISTS media_uploads (
  id               CHAR(26) PRIMARY KEY,
  merchant_id      CHAR(26) NOT NULL,
  business_id      CHAR(26),
  file_path        VARCHAR(500) NOT NULL,   -- local path in Phase Zero
  public_url       VARCHAR(500) NOT NULL,   -- served URL
  content_type     VARCHAR(100) NOT NULL,
  size_bytes       INT UNSIGNED NOT NULL,
  purpose          ENUM('cover','gallery','look','service') NOT NULL,
  rights_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
);
```

### 3.10 Analytics events

```sql
-- 009_analytics_events.sql
CREATE TABLE IF NOT EXISTS analytics_events (
  id                      CHAR(26) PRIMARY KEY,
  event_id                VARCHAR(100) NOT NULL,
  anonymous_user_id       VARCHAR(100) NOT NULL,
  session_id              VARCHAR(100) NOT NULL,
  event_name              VARCHAR(100) NOT NULL,
  timestamp               DATETIME(3) NOT NULL,
  page_path               VARCHAR(500),
  page_title              VARCHAR(255),
  merchant_id             VARCHAR(100),
  merchant_name           VARCHAR(255),
  category_id             VARCHAR(100),
  category_name           VARCHAR(255),
  search_query            VARCHAR(500),
  source_surface          VARCHAR(100),
  source_section          VARCHAR(100),
  product_version         VARCHAR(50),
  screen_width            SMALLINT UNSIGNED,
  screen_height           SMALLINT UNSIGNED,
  operating_system        VARCHAR(100),
  environment             VARCHAR(50),
  metadata                JSON,
  received_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY analytics_event_id_uk (event_id)
);

CREATE INDEX IF NOT EXISTS analytics_event_name_idx
  ON analytics_events (event_name, timestamp);
CREATE INDEX IF NOT EXISTS analytics_session_idx
  ON analytics_events (session_id);
```

**`event_id` is the dedup key.** The mobile client retries on failure.
An insert that conflicts on `event_id` must succeed silently — use
`INSERT IGNORE` or `ON DUPLICATE KEY UPDATE received_at = received_at`.
Never return an error for a duplicate event.

---

## 4. Authentication

### 4.1 Merchant signup

```
POST /api/auth/merchant/signup
Body: {
  "fullName": "Jane Wanjiru",
  "email": "jane@glamstudio.co.ke",
  "password": "..."
}
```

1. Validate all three fields present.
2. Validate email format.
3. Validate password: minimum 8 characters. No complexity rules — length
   is the only requirement that meaningfully improves security at this
   stage.
4. Check `merchants` table for existing email. Return 409 if taken.
5. Hash password with bcrypt, cost 12.
6. Generate a ULID for the merchant ID.
7. Insert into `merchants`.
8. Issue a bearer token (see §4.3).
9. Return the token and the merchant record.

```json
Response 201: {
  "token": "kp_m_...",
  "merchant": {
    "id": "01J...",
    "fullName": "Jane Wanjiru",
    "email": "jane@glamstudio.co.ke",
    "status": "active",
    "hasBusiness": false
  }
}
Response 409: { "error": "email_taken" }
Response 422: { "error": "validation_failed", "fields": ["password"] }
```

### 4.2 Merchant login

```
POST /api/auth/merchant/login
Body: { "email": "jane@glamstudio.co.ke", "password": "..." }
```

1. Look up merchant by email. Return 401 (not 404) if not found — do not
   reveal whether the email exists.
2. Compare password against `password_hash` via bcrypt.
3. Return 401 on mismatch. Do not describe why — a generic "invalid
   credentials" prevents enumeration.
4. Check `status !== 'suspended'`. Return 403 with `account_suspended`
   if suspended.
5. Issue a bearer token.
6. Return the token and the merchant record including `hasBusiness`.

```json
Response 200: {
  "token": "kp_m_...",
  "merchant": {
    "id": "01J...",
    "fullName": "Jane Wanjiru",
    "email": "jane@glamstudio.co.ke",
    "status": "active",
    "hasBusiness": true,
    "businessId": "01J..."
  }
}
Response 401: { "error": "invalid_credentials" }
Response 403: { "error": "account_suspended" }
```

### 4.3 Bearer tokens

- Generate: 32 random bytes → base64url string. Prefix with `kp_m_` for
  readability.
- Store: SHA-256 hash of the raw token in `merchant_tokens`.
- Lifetime: 90 days from issue. Slide the window on each use — extend by
  7 days if within 14 days of expiry.
- A merchant may have up to 3 active tokens (phone + tablet + web).
  Delete the oldest on the 4th issue.

**Verification middleware (`src/middleware/merchant-auth.js`):**
1. Extract from `Authorization: Bearer kp_m_...` header.
2. SHA-256 hash it.
3. Look up in `merchant_tokens` joining `merchants`.
4. Reject if not found, expired, or merchant suspended.
5. Update `last_used_at` and slide expiry if needed.
6. Attach `{ merchantId, businessId }` to `request.merchant`.

### 4.4 Signout

```
POST /api/auth/merchant/signout
Authorization: Bearer kp_m_...
```

Deletes the current `merchant_tokens` row. Returns 200.

### 4.5 Me

```
GET /api/auth/merchant/me
Authorization: Bearer kp_m_...
```

Returns the current merchant record with `hasBusiness` and `businessId`.
Used by the mobile client on launch to validate a stored token.

### 4.6 Password reset (admin-only)

No self-service reset in Phase Zero. The team resets merchant passwords
via the admin panel — find the merchant, set a new password hash. The
admin panel exposes a "Reset password" action that accepts a new password
and calls `bcrypt.hash()` before writing.

Document this in the admin panel UI so the team knows the flow.

---

## 5. Public catalog API

No authentication required. Consumed by the consumer mobile app.

### 5.1 Catalog snapshot endpoint

```
GET /api/public/catalog
```

**Phase Zero implementation: live query, not a pre-built snapshot.**

At 50 providers and 500 users, the snapshot pattern adds complexity with
no measurable benefit. Build it as a live query with a 5-minute in-memory
cache (`node-cache` or a simple `Map` with a timestamp). Add the R2
snapshot builder in Phase One when the payload grows.

**Query:**
1. Select all businesses where `publication_status = 'published'`.
2. For each business, select its active services.
3. For each business, select upcoming availability (next 14 days).
4. Compute `open_now` from the `hours` field and current Nairobi time
   (UTC+3). See §5.2.
5. Set `distance = ""` — no geolocation in Phase Zero.
6. Set `specialist_ids = []` — no professionals in Phase Zero.
7. Assemble the response matching `publicCatalogSnapshotSchema` exactly.
8. Set `generated_at` to the current timestamp.

**In-memory cache:**
```javascript
let catalogCache = null;
let cacheBuiltAt = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isCacheValid() {
  return catalogCache && (Date.now() - cacheBuiltAt) < CACHE_TTL_MS;
}
```

**Response headers:**
```
Cache-Control: public, max-age=300
Content-Type: application/json
```

**The response shape is governed by `src/schemas/catalog.ts` in the
mobile app. Do not change field names. Every field listed in the mobile
schema must be present in the response.**

**Field mapping — businesses row → provider object:**

| Column | JSON field | Phase Zero value |
|---|---|---|
| `id` | `id` | as stored |
| `slug` | `slug` | as stored |
| `industry` | `industry` | as stored |
| `category_id` | `categoryId` | as stored |
| `subcategory` | `subcategory` | null if empty |
| `name` | `name` | as stored |
| `area` | `area` | as stored |
| `""` | `distance` | always `""` |
| `rating` | `rating` | omit if null |
| `verified_count` | `verifiedCount` | as stored |
| `starting_price` | `startingPrice` | omit if null |
| `main_offering` | `mainOffering` | as stored |
| `verified` | `verified` | boolean |
| computed | `openNow` | see §5.2 |
| `cover_url` | `cover` | as stored |
| `full_address` | `address` | as stored |
| location fields | `location` | object, see below |
| `payment_settings` | `paymentSettings` | parsed JSON |
| `hours` | `hours` | as stored |
| `phone` | `phone` | as stored |
| service IDs | `serviceIds` | array of service IDs for this business |
| `[]` | `specialistIds` | always `[]` |
| `highlights` | `highlights` | parsed JSON |
| `facilities` | `facilities` | parsed JSON |
| `would_return` | `wouldReturn` | as stored |
| `trust_metric` | `trustMetric` | as stored |
| `next_available` | `nextAvailable` | omit if null |
| `positioning` | `positioning` | omit if null |
| `partnership_status` | `partnershipStatus` | as stored |
| `publication_status` | `publicationStatus` | as stored |
| `limited_listing` | `limitedListing` | boolean |
| `booking_enabled` | `bookingEnabled` | boolean |
| `booking_method` | `bookingMethod` | as stored |
| `recommended` | `recommended` | boolean |
| `featured` | `featured` | boolean |
| `gallery_urls` | `gallery` | parsed JSON array |
| `public_contacts` | `publicContacts` | parsed JSON |

**Location object:**
```json
{
  "latitude": -1.2686,
  "longitude": 36.8069,
  "fullAddress": "...",
  "area": "Westlands",
  "city": "Nairobi",
  "locationType": "FIXED_VENUE",
  "serviceAreas": [],
  "landmark": "",
  "parkingAvailable": false
}
```

Note: `city` is always the string `"Nairobi"` — the mobile schema has
`z.literal("Nairobi")` and will reject any other value.

### 5.2 Computing openNow

```javascript
function computeOpenNow(hoursString) {
  // hoursString example: "Mon-Sat 9:00-18:00" or "Mon-Sun 8:00-20:00"
  // Return true if the current Nairobi time falls within the hours range.
  // Return false if the hours string cannot be parsed.
  const now = new Date();
  const nairobiTime = new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false
  }).formatToParts(now);
  // Parse nairobiTime parts, compare against hoursString.
  // If parsing fails, return false — never return true on bad data.
}
```

Parse the `hours` field conservatively. If the format is ambiguous or
unparseable, return `false`. A venue shown as closed when it is open is
a minor inconvenience. A venue shown as open when it is closed is a
broken user experience.

### 5.3 Kill switch

The `appConfig` field in the response:

```json
"appConfig": {
  "minVersion": "0.1.0",
  "message": "Please update KiliPicks to continue."
}
```

Store `min_version` and `kill_switch_message` as two rows in a simple
`app_config` key-value table, editable via the admin panel. If no row
exists, omit `appConfig` from the response — the mobile client treats
a missing field as "no constraint."

```sql
CREATE TABLE IF NOT EXISTS app_config (
  key_name   VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
               ON UPDATE CURRENT_TIMESTAMP(3)
);
```

---

## 6. Merchant API

All routes require `Authorization: Bearer kp_m_...` verified by
`merchant-auth` middleware.

### 6.1 Business onboarding

**Create business**
```
POST /api/merchant/businesses
Body: {
  "name": "Glam Studio Westlands",
  "email": "glam@example.com",
  "categoryId": "hair",
  "phone": "+254712345678",
  "industry": "beauty"
}
```

1. Check the merchant does not already have a business. Return 409 if so.
2. Generate a unique slug from `name` (kebab-case, append `-2`, `-3` etc.
   on collision).
3. Insert with `publication_status: 'draft'`, `limited_listing: 1`.
4. Return the created business.

**Update business details**
```
PATCH /api/merchant/businesses/:businessId
Body: { /* any subset of editable fields */ }
```

Editable fields: `name`, `email`, `phone`, `categoryId`, `subcategory`,
`mainOffering`, `positioning`, `hours`, `highlights`, `facilities`,
`publicContacts`, `paymentSettings`.

Non-editable via this endpoint: `publicationStatus`, `limitedListing`,
`featured`, `recommended`, `verified`, `partnershipStatus`. Those are
admin-only.

Only the owning merchant may update their business. Return 403 otherwise.

**Update location**
```
PATCH /api/merchant/businesses/:businessId/location
Body: {
  "fullAddress": "...",
  "area": "Westlands",
  "latitude": -1.2686,
  "longitude": 36.8069,
  "locationType": "FIXED_VENUE",
  "landmark": "",
  "parkingAvailable": false,
  "serviceAreas": []
}
```

**Get own business**
```
GET /api/merchant/businesses/me
```

Returns the full business record for the authenticated merchant.
Returns 404 with `{ "error": "no_business" }` if the merchant has not
yet created one — the mobile client uses this to decide whether to
show step 2 of onboarding or go straight to the dashboard.

### 6.2 Media upload

**Upload file**
```
POST /api/merchant/media/upload
Authorization: Bearer kp_m_...
Content-Type: multipart/form-data
Fields: file, purpose, rightsConfirmed
```

1. Validate `rightsConfirmed === "true"`. Reject with 422 if false.
2. Validate `content_type` against allowlist:
   `image/jpeg`, `image/png`, `image/webp`, `video/mp4`.
3. Validate file size: images ≤ 5MB, video ≤ 50MB.
4. Generate a ULID filename. Preserve the extension.
5. Write to `uploads/{purpose}/{ulid}.{ext}`.
6. Insert a `media_uploads` row.
7. Return the public URL.

```json
Response 201: {
  "uploadId": "01J...",
  "url": "http://localhost:3000/uploads/gallery/01J....jpg"
}
```

Use `@fastify/multipart` for file handling.
Serve `uploads/` as static files via `@fastify/static`.

**In Phase Zero, no image compression is applied.** The mobile client
compresses before upload (`expo-image-manipulator`). Accept whatever
arrives. Add server-side reprocessing in Phase One.

### 6.3 Services

```
GET    /api/merchant/businesses/:businessId/services
POST   /api/merchant/businesses/:businessId/services
PATCH  /api/merchant/services/:serviceId
DELETE /api/merchant/services/:serviceId
```

**Create service**
```json
{
  "name": "Hair wash and blow dry",
  "categoryId": "hair",
  "description": "Includes scalp massage and styling.",
  "price": 1500,
  "priceType": "fixed",
  "durationMinutes": 60,
  "bookingEnabled": false
}
```

After create or update, invalidate the in-memory catalog cache so the
next consumer fetch sees the change within one request.

**Delete:** Soft-delete by setting `active = 0`. Never hard-delete a
service that may be referenced by existing bookings.

### 6.4 Bookings

```
GET  /api/merchant/bookings?date=2026-09-03&status=confirmed
POST /api/merchant/bookings
PATCH /api/merchant/bookings/:bookingId
```

**List:** Returns bookings for the merchant's business. Filtered by
optional `date` (YYYY-MM-DD) and `status`. Sorted by date and time
ascending.

**Create**
```json
{
  "customerName": "Grace Akinyi",
  "customerPhone": "+254700000000",
  "serviceId": "01J...",
  "date": "2026-09-10",
  "time": "10:00",
  "durationMinutes": 60,
  "notes": "Prefers no heat"
}
```

**Update:** Allowed field is `status` only via this endpoint.

### 6.5 Availability

```
GET    /api/merchant/businesses/:businessId/availability
         ?from=2026-09-01&to=2026-09-14
POST   /api/merchant/businesses/:businessId/availability
DELETE /api/merchant/availability/:availabilityId
```

**Create slot:** Upserts on the unique key
`(businessId, serviceId, professionalId, date, time)`.

### 6.6 Looks

```
GET    /api/merchant/businesses/:businessId/looks
POST   /api/merchant/businesses/:businessId/looks
PATCH  /api/merchant/looks/:lookId
DELETE /api/merchant/looks/:lookId
```

**Create look**
```json
{
  "mediaUrls": ["http://localhost:3000/uploads/looks/01J....jpg"],
  "mediaType": "photos",
  "categories": ["hair"],
  "serviceId": "01J...",
  "description": "Box braids with gold cuffs.",
  "tags": ["braids", "protective"],
  "status": "published"
}
```

Validate that `mediaUrls` contains only URLs that match confirmed
`media_uploads` rows owned by this merchant. Reject any URL that does not.
Validate `description` ≤ 100 characters.
Validate `tags` array length ≤ 5.

---

## 7. Analytics ingest

```
POST /api/analytics/events
X-App-Token: <ANALYTICS_APP_TOKEN from env>
Body: { "events": [ /* array */ ] }
```

**Authentication:** Static shared token in `X-App-Token` header. Compare
directly to `process.env.ANALYTICS_APP_TOKEN`. Return 401 if missing or
wrong.

**Rate limit:** 100 requests per minute per IP using `@fastify/rate-limit`.

**Processing:**

1. Validate body is `{ events: Array }` and array is non-empty (max 500).
2. For each event validate `eventId` is a non-empty string. Reject the
   entire batch if any event lacks one.
3. Generate a ULID `id` for each event row.
4. Bulk insert:
```sql
INSERT IGNORE INTO analytics_events
  (id, event_id, anonymous_user_id, session_id, event_name,
   timestamp, page_path, ...)
VALUES (?, ?, ?, ?, ?, ?, ?, ...), ...
```
`INSERT IGNORE` silently skips rows that conflict on `event_id`. This
is the idempotency guarantee.
5. Return counts.

```json
Response 200: {
  "received": 50,
  "inserted": 47,
  "deduplicated": 3
}
```

Unknown `event_name` values are accepted and stored. Never reject on
an unknown event name — the mobile client ships new event names before
the backend schema is updated.

---

## 8. Admin panel (AdminJS)

AdminJS is an open-source Node.js admin framework. It mounts into the
Fastify server and generates CRUD UI from your database schema. No
separate frontend to build.

### 8.1 Setup

```javascript
// src/admin/index.js
import AdminJS from 'adminjs'
import AdminJSFastify from '@adminjs/fastify'
import { Database, Resource } from '@adminjs/sql'

AdminJS.registerAdapter({ Database, Resource })
```

### 8.2 Admin authentication

```javascript
await AdminJSFastify.buildAuthenticatedRouter(adminJs, {
  authenticate: async (email, password) => {
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      return { email }
    }
    return null
  },
  cookiePassword: process.env.JWT_SECRET,
}, app)
```

No admin row in the database. Credentials come from env only.

### 8.3 Resources exposed in the admin panel

| Resource | Readable | Editable fields | Actions |
|---|---|---|---|
| Merchants | ✓ | `status` | Suspend, reset password |
| Businesses | ✓ | All admin-only fields (see below) | Publish, feature, verify |
| Services | ✓ | `active` | — |
| Looks | ✓ | `status` | Approve, archive |
| Media uploads | ✓ | — | View image |
| Analytics events | ✓ | — | — |
| App config | ✓ | `value` | — |

**Admin-only business fields** (not editable by merchants via the API):
`publication_status`, `limited_listing`, `partnership_status`,
`featured`, `recommended`, `verified`, `booking_enabled`, `booking_method`.

### 8.4 Custom admin actions

**Publish business:** Sets `publication_status = 'published'`,
`limited_listing = 0`. Invalidates the catalog cache.

**Reset merchant password:** Takes a new password input, hashes with
bcrypt cost 12, updates `merchants.password_hash`. Invalidates all
active tokens for that merchant.

**Suspend merchant:** Sets `merchants.status = 'suspended'`. Invalidates
all active tokens.

### 8.5 Analytics summary page

A custom AdminJS page (not auto-generated) showing:
- DAU for the last 7 days (chart)
- Top 10 event names by count
- Search → detail rate
- Detail → contact rate
- Top search queries

Computed from the `analytics_events` table on page load. No caching
needed for an internal tool.

---

## 9. CORS

The mobile app's Metro dev proxy must be deleted once this server is
running. For that to work, the server must send correct CORS headers.

```javascript
await app.register(import('@fastify/cors'), {
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Token'],
})
```

This unblocks the deletion of `metro.config.js` proxy and the
`usesWebDevProxy` branch in `src/config/env.ts` on the mobile side.

---

## 10. Dependencies

```json
{
  "dependencies": {
    "fastify": "^4",
    "@fastify/cors": "^9",
    "@fastify/static": "^7",
    "@fastify/multipart": "^8",
    "@fastify/rate-limit": "^9",
    "mysql2": "^3",
    "bcrypt": "^5",
    "ulid": "^2",
    "adminjs": "^7",
    "@adminjs/fastify": "^4",
    "@adminjs/sql": "^1",
    "node-cache": "^5",
    "dotenv": "^16"
  },
  "devDependencies": {
    "nodemon": "^3"
  }
}
```

No ORM. Raw SQL via `mysql2/promise`. This keeps queries readable,
avoids ORM abstraction surprises, and makes the Phase One Postgres
migration explicit rather than hidden.

---

## 11. Local development setup

```bash
# 1. Create the database
mysql -u root -e "CREATE DATABASE IF NOT EXISTS kilipicks;"

# 2. Install dependencies
npm install

# 3. Copy and fill env
cp .env.example .env

# 4. Run migrations
node migrations.js

# 5. Start the server
npm run dev        # nodemon src/app.js
```

Server runs at `http://localhost:3000`.
Admin panel at `http://localhost:3000/admin`.
Uploads served at `http://localhost:3000/uploads/`.

---

## 12. Commit sequence

Work in this exact order. Every commit leaves the server startable.

1. `chore: project setup, package.json, env, folder structure`
2. `feat: MySQL connection pool and migration runner`
3. `feat: migrations 001-009 — full schema`
4. `feat: merchant auth — signup, login, signout, me, token middleware`
5. `feat: public catalog endpoint with 5-minute in-memory cache`
6. `feat: admin panel with AdminJS — all resources and custom actions`
7. `feat: merchant business CRUD — create, update, location, get-me`
8. `feat: media upload — multipart, local filesystem, static serving`
9. `feat: merchant services CRUD`
10. `feat: merchant bookings CRUD`
11. `feat: merchant availability CRUD`
12. `feat: merchant looks CRUD`
13. `feat: analytics ingest with INSERT IGNORE dedup`
14. `feat: kill switch app_config table and admin UI`
15. `chore: verify CORS from mobile dev client, delete Metro proxy`

---

## 13. Before you connect the mobile app

Run through this checklist before pointing the mobile client at this
server:

- [ ] `GET /api/public/catalog` response passes the mobile app's zod
      validation with no errors
- [ ] `city` field in every location object is exactly `"Nairobi"` —
      the mobile schema has `z.literal("Nairobi")` and will reject
      anything else
- [ ] `specialistIds` is `[]` on every provider — never `null`
- [ ] `distance` is `""` on every provider — never `null`
- [ ] `highlights`, `facilities`, `gallery` are arrays — never `null`
- [ ] `publicContacts` is an object — never `null` or an array
- [ ] Analytics `POST` with the same `eventId` twice inserts one row
- [ ] Admin panel login works with env credentials
- [ ] CORS headers present on all responses
- [ ] `uploads/` directory is writable and files are served correctly