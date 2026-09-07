# KiliPicks backend

Node.js + Fastify + MySQL. The single backend for the KiliPicks mobile app —
merchant and consumer auth, and the public catalog. Local-first: everything
runs on one developer machine, no cloud accounts required to start the server.

This used to be developed as a separate repo (`kilipicks-server`) and a
parallel JSON-file auth server lived at this same path (`backend/`). Both are
retired: this is now the one backend, moved in wholesale with its
Fastify/MySQL design intact, plus real consumer auth (see below).

## Requirements

- Node.js 20+
- MySQL 8, running locally, with a known root password

## Run locally

```bash
cd backend
npm install
npm run init:env      # generates JWT_SECRET / ADMIN_PASSWORD / ANALYTICS_APP_TOKEN
# edit .env and fill in DB_PASSWORD
npm run migrate       # creates the kilipicks database and applies all migrations
npm run dev
```

Or from the mobile repo root: `pnpm backend:install`, `pnpm backend:migrate`,
`pnpm backend:dev`.

Server: http://localhost:3000
Uploads served at: http://localhost:3000/uploads/ (once media upload ships — not yet built)

## Validate

```bash
npm run smoke            # cumulative endpoint smoke test (needs a running server)
npm run check:catalog    # asserts the public catalog response against every invariant the mobile app's zod schema requires
npm run check:open-now   # pure-function fixture tests for hours parsing
npm run seed:dev         # seeds a demo merchant + 4 businesses so the catalog isn't empty
```

## Two auth systems, one backend

Per the backend PRD's ground rule: consumers and merchants never share a row,
a role field, or an auth system. This backend has two of each — two tables,
two password columns, two token tables, two bearer-token prefixes
(`kp_u_` for consumers, `kp_m_` for merchants) — joined only by
`merchants.owner_user_id`, which is nullable (a merchant can exist with no
consumer account at all).

- `POST /api/auth/consumer/signup` — body `{ fullName, email, password, accountType }`.
  Always creates a consumer row. When `accountType` is `"merchant"`, also
  creates a linked merchant row in the same request (this is what the mobile
  app's profile-selection step does) and returns both tokens.
- `POST /api/auth/consumer/login` — authenticates the consumer only. If a
  linked merchant exists and the same password matches its own hash, a
  merchant token is included too; if it doesn't match (the merchant password
  was changed independently since), the response includes
  `merchant.needsMerchantSignIn: true` instead of a token.
- `GET /api/auth/consumer/me`, `POST /api/auth/consumer/signout` — bearer
  auth against the consumer token.
- `POST /api/auth/consumer/merchant` — "become a seller" for an
  already-signed-in consumer with no merchant yet. Requires its own
  password (a real, separate credential — never inherited from the consumer
  session) because it creates a genuinely separate row. 409
  `merchant_already_linked` if one already exists.
- `POST /api/auth/merchant/signup|login|signout`, `GET /api/auth/merchant/me`
  — standalone merchant auth, unchanged from the original spec. Used
  directly by a business owner with no consumer account, and internally by
  the two consumer-side flows above.

See `src/services/tokens.js` for the shared token-issuance logic both
systems are built on (90-day sliding expiry, 3-token cap) — the one place
that shape is expressed, so it can't drift between the two.

## Testing from the mobile app

Point `EXPO_PUBLIC_AUTH_API_BASE_URL` at this server:

- Same machine, web/simulator: `http://localhost:3000`
- Android emulator: `http://10.0.2.2:3000` (the mobile app's default)
- Physical phone on the same WiFi: this machine's LAN IP, e.g.
  `http://192.168.1.20:3000`. Allow the server through Windows Firewall for
  private networks on first connection.

The public catalog (`GET /api/public/catalog`) is built and matches the
mobile app's zod schema exactly, but the mobile app does not point at it yet
— `EXPO_PUBLIC_API_BASE_URL` still targets the external demo host. Repointing
catalog traffic here is a deliberate follow-up, not done as part of the auth
consolidation, since it also means seeding real business data and touching
analytics' target host.

## Current status

- [x] 1–3. Project setup, DB pool, migrations 001–010
- [x] 4. Merchant auth — signup, login, signout, me, token middleware
- [x] 4b. Consumer auth — signup, login, signout, me, plus the
      consumer↔merchant link (migrations 011–013), added when this moved
      into the mobile repo and became the one canonical backend
- [x] 5. Public catalog endpoint with 5-minute in-memory cache
- [ ] 6. Admin panel (AdminJS)
- [ ] 7. Merchant business CRUD — the next real gap: a merchant can sign up
      today with nowhere to actually create a business yet
- [ ] 8. Media upload
- [ ] 9–12. Merchant services/bookings/availability/looks CRUD
- [ ] 13. Analytics ingest
- [ ] 14. Kill switch admin UI
- [ ] 15. Repoint the mobile app's catalog fetch here, delete its Metro dev-proxy

**Live-verified.** Migrations 001–013 have been applied against a real local
MySQL instance. `npm run smoke` exercises consumer signup, linked-merchant
signup, login (including the shared-password merchant re-auth), cross-auth
rejection between the two token types, become-a-seller, and the
duplicate-link conflict — all passing. `npm run check:catalog` and
`npm run check:open-now` pass against live data.
