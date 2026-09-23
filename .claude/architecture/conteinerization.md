# KiliPicks — Backend Dockerization Plan

**Document type:** Implementation plan for Claude Code
**Repo:** `github.com/Taliano008/Kilipics`
**Baseline:** `8abf07a`
**Scope:** `backend/` only.

---

## 0. Scope — read this before anything else

**Docker applies to the backend only.** The mobile app (`app/`, `src/`)
is not a Docker candidate — it's a React Native app, and it ships
through EAS Build to the Play Store / an APK, a completely separate
pipeline that this document does not touch.

What this document covers: the main Fastify API (`src/app.js`), the
AdminJS panel (`src/admin/server.js` — genuinely a separate process, not
a design choice this plan should try to undo), and how MySQL and file
uploads fit around both.

---

## 1. What "shipped" actually needs, given what already exists

The backend already has real operational tooling that a Docker setup
should use, not replace:

- `npm run migrate` — applies migrations. This becomes the container's
  startup step, not a manual one-off.
- `npm run seed:dev` — dev-only seed data. Never runs in a production
  image.
- `npm run smoke` — an existing smoke-test script. This is the natural
  basis for a container health check, rather than inventing a new one.
- Two independently startable processes (`start` vs `admin:start`) —
  the Docker setup mirrors this as two services, not one container
  awkwardly running both.

---

## 2. Two real deployment shapes — decide before building

### 2.1 Local development (docker-compose)

Three services: `mysql`, `api`, `admin`. This replaces "MySQL installed
locally on your machine" with a disposable, reproducible container —
solves the "works on my machine" class of problem this project has hit
before (the hardcoded LAN IP for `UPLOADS_BASE_URL` is a symptom of not
having this yet).

### 2.2 Production shape

**MySQL is NOT a container here.** A production deployment needs a
managed database (RDS, PlanetScale, a managed MySQL instance) with real
backups and failover — a MySQL container with no backup strategy is not
a production database, it's a development database that happens to be
running somewhere else. The `api` and `admin` images connect to an
external `DB_HOST`, same as they would locally, just pointed at a real
managed instance via env vars.

This split matters: build one set of images that work identically in
both shapes, differing only in environment configuration — never build
a "local Docker image" and a separate "production Docker image."

---

## 3. The uploads problem — a real architectural decision, not a Docker detail

`UPLOADS_DIR=./uploads` writes to local container filesystem. This has
been a known limitation since the original backend design (local
filesystem was explicitly the Phase Zero choice, with R2/S3 flagged as
the eventual migration). Containerizing makes this limitation concrete
in a new way:

- A container's filesystem is ephemeral by default — a redeploy loses
  every uploaded photo unless a volume is attached.
- If you ever run more than one API replica (for uptime or load), each
  replica has its own separate filesystem — an upload written by one
  replica won't be visible to a request served by another.

**For shipping now:** mount a persistent named volume for `UPLOADS_DIR`
and run exactly one API replica. This is honest about the limitation
rather than hiding it, and it's consistent with everything else in this
project's philosophy — don't pretend a workaround is a real fix.

**Flag explicitly, don't silently build around it:** if the pilot needs
more than one replica, or the deployment target doesn't support
persistent volumes (many serverless/PaaS platforms don't), the R2/S3
migration stops being optional and becomes a prerequisite. This document
does not build that migration — it surfaces the decision point clearly
so it's made on purpose.

---

## 4. Dockerfile — one image, two entrypoints

Single multi-stage build produces one image; `admin` and `api` are the
same image started with a different command, not two separately built
images. They share every dependency already.

```dockerfile
# backend/Dockerfile

FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS runtime
COPY . .
# Uploads directory must exist before the volume mount point is used
RUN mkdir -p uploads
EXPOSE 3000 3050
CMD ["node", "src/app.js"]
```

**Do not bake `.env` or any secret into the image.** Every value in
`backend/.env.example` is supplied at container runtime via
`docker-compose.yml`'s `env_file` locally, or the deployment platform's
secret manager in production. This is the same lesson this project
already learned the hard way with the Sentry DSN — don't repeat it by
baking secrets into an image layer instead of a committed file.

**Never copy `node_modules` from the host.** `npm ci` inside the build
ensures native dependencies (`bcrypt`, `mysql2`) compile against the
container's actual architecture, not the developer's machine's.

---

## 5. docker-compose.yml — local development

```yaml
# backend/docker-compose.yml

services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_DATABASE: kilipicks
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build: .
    command: sh -c "npm run migrate && node src/app.js"
    env_file: .env
    environment:
      DB_HOST: mysql
    ports:
      - "3000:3000"
    volumes:
      - uploads-data:/app/uploads
    depends_on:
      mysql:
        condition: service_healthy

  admin:
    build: .
    command: node src/admin/server.js
    env_file: .env
    environment:
      DB_HOST: mysql
    ports:
      - "3050:3050"
    volumes:
      - uploads-data:/app/uploads
    depends_on:
      mysql:
        condition: service_healthy

volumes:
  mysql-data:
  uploads-data:
```

**Migrations run as part of the `api` service's startup command, not as
a separate manual step.** This means every `docker-compose up` produces
a database that's actually current — closing the exact class of problem
flagged earlier in this project where staging/production could silently
drift from what migrations actually exist.

**Both `api` and `admin` mount the same `uploads-data` volume.** They
need to see the same files — the admin panel's "view image" action reads
what the API wrote.

---

## 6. Health checks — use what already exists

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node scripts/smoke.mjs || exit 1
```

Confirm `smoke.mjs` can run in this mode (no external test harness, just
a script that hits the running server and exits non-zero on failure) —
if it currently assumes a dev environment with seed data, that needs
adjusting before this works as a container health check. Check before
assuming it's ready to use as-is.

---

## 7. What this plan does not do

- Does not touch the mobile app or EAS build process at all.
- Does not solve the uploads-volume limitation — it names the decision
  point and ships the honest interim fix (§3).
- Does not choose your production hosting platform. The images this
  produces run identically on Railway, Render, a bare VPS with Docker,
  or any container platform — that choice is separate from this plan.
- Does not add CI/CD. Building the image is step one; automatically
  building and deploying it on every push is a follow-on decision, not
  bundled into containerizing the app itself.

---

## 8. Commit sequence

1. `chore: add backend Dockerfile`
2. `chore: add docker-compose.yml for local development`
3. `chore: wire migrations into the api service startup command`
4. `chore: add container health check using the existing smoke script`
5. `docs: document the Docker workflow, replacing "install MySQL
   locally" in onboarding instructions`

Step 3 is the one worth testing carefully — confirm a completely fresh
`docker-compose up` (empty MySQL volume) actually produces a working,
migrated database with no manual intervention. That's the real test of
whether this setup achieves what "ready to be shipped" means.

---

## 9. Open question for you, not Claude Code

Does the pilot need more than one API replica, or a deployment platform
without persistent volume support? If yes, §3's interim fix isn't
sufficient, and the R2/S3 migration needs to happen before this ships,
not after. Worth deciding now rather than discovering it under pressure
during the pilot.