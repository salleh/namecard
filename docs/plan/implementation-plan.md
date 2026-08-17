# e-Namecard — Implementation Plan

Derived from `CLAUDE.md`. Stack: Next.js (App Router, TypeScript strict, standalone) · PostgreSQL · Prisma · Auth.js (Entra OIDC) · Serwist PWA · `qr-code-styling`. Deployment: Docker Compose (app + db + internal Caddy) behind an external DMZ nginx.

## Locked decisions

- **Entra app registration** is requested from IT (long-lead external dependency). The no-auth surface is built and tested first; auth is developed against a dev/test provider and switched to the real tenant issuer + creds when available.
- **Photo storage:** PostgreSQL `bytea` in `StaffCard`. Excluded from the QR payload; included in `.vcf` and page display only.
- **Address & website:** company-wide defaults seeded from config, each individually overridable per staff on `/me`.
- **Admin gate:** an authenticated admin console, authorized by membership of a custom **M365 security group** surfaced as a token/groups claim (not stored in the DB).
- **Brand assets:** square org logo (transparent, square canvas) is the single brand mark. Stored at `public/brand/logo.png` (1024px master), reused as the **centered QR overlay** and as the source for **PWA icons** (`public/icons/icon-512.png`, `icon-192.png`) and favicon. No separate wordmark asset needed.
- **Cross-cutting defaults:** TypeScript strict everywhere; TDD with 80%+ coverage; Prisma migrations committed; secrets only via `.env` (committed `.env.example`); public route rate-limited as defense-in-depth on top of the activation gate; never expose internal staff IDs in URLs, QR payloads, or markup.

---

## Step 1 — Architecture blueprint & repo scaffold

**Intent:** Establish the greenfield skeleton once: Next.js App Router (TS strict, standalone output), folder conventions (feature-oriented, small files), config module (company address/website defaults, env schema validation), testing stack (Vitest + React Testing Library + Playwright), Serwist PWA baseline (manifest + service worker registration), lint/format, `.gitignore` (exclude `.env*` except `.env.example`), `.env.example`, README stub, and `git init`. Produce the module map that later steps build into.

Out of scope: business logic, DB schema, auth wiring, Docker/compose.

## Step 2 — Data model & Prisma schema/migrations

**Intent:** Model `StaffCard` per spec — `id`, `entraObjectId` (unique), `emailSlug` (unique, lowercased local part), `activated`, `disabled`, all vCard fields (`displayName`, `givenName`, `surname`, `jobTitle`, `department`, `company`, `email`, `businessPhone`, `mobilePhone`, `officeLocation`, `address`, `website`), `photo` (`bytea`), `graphSnapshot` (jsonb), timestamps. Add the initial committed migration and a seed script for local/test fixtures. No internal staff ID column.

Out of scope: query call-sites, auth, UI.

## Step 3 — Shared vCard 3.0 + styled QR core library

**Intent:** One server-side vCard 3.0 generator consumed by both outputs. QR path encodes the vCard text **without** the photo, styled with the centered org logo at error-correction level H. `.vcf` path emits the same vCard **with** the base64 `PHOTO`. Pure, well-tested functions covering escaping, folding, empty-field omission, and company-default/override merge for address/website.

Out of scope: HTTP routes, page rendering.

## Step 4 — Public card page & `.vcf` download route

**Intent:** SSR `/<email_name>` rendering staff details, the styled QR (vCard text inline), and a download button; `GET /<email_name>.vcf` serving `text/vcard` (photo included). Resolve only cards that are `activated` and not `disabled` — otherwise 404. Add rate limiting to blunt slug enumeration. No internal IDs anywhere in markup or payload.

Out of scope: auth, editing, admin.

## Step 5 — Entra OIDC auth, Graph prefill & admin group claim

**Intent:** Auth.js OIDC authorization-code flow against the tenant-specific issuer (never `common`). On first login, call Microsoft Graph (`/me`, `/me/photo/$value`, delegated `User.Read`) to snapshot the profile into PostgreSQL, set `activated=true`, and key the row by Entra object id; thereafter the DB is source of truth (no write-back). Extract the M365 admin security-group membership as a session claim for later gating. Trust `X-Forwarded-Proto`/`Host`; Secure httpOnly cookies. Build against a dev provider; raise and document the production Entra app-registration request (redirect URIs, `User.Read`, and the **groups optional claim / `GroupMember.Read.All`** needed for the admin gate).

Out of scope: the `/me` editor UI, the admin console UI.

## Step 6 — `/me` self-service card editor

**Intent:** Authenticated `/me` page: show Graph-prefilled values, let staff fill missing fields and override any prefilled value (overrides affect only the card), pre-fill address/website from company config with per-staff override, upload/replace photo (stored as `bytea`), and preview the live card + QR. Persist to the owner's `StaffCard`; never write back to Entra.

Out of scope: admin functions, changing another user's card.

## Step 7 — Admin console (M365 group-gated)

**Intent:** Authenticated admin routes authorized solely by the M365 admin security-group claim from Step 5. List/search activated staff and toggle `disabled` (and `activated` where needed) so a leaver's card stops resolving. Deny and audit non-member access. No internal staff IDs surfaced.

Out of scope: bulk import, Entra reconciliation automation.

## Step 8 — PWA offline & own-card caching

**Intent:** Finalize Serwist service worker + manifest for installability, and cache the logged-in user's own card + QR for offline display, so a staff member can present their QR without connectivity. Sensible cache invalidation on card edits.

Out of scope: offline editing, caching other users' cards.

## Step 9 — Docker, Compose, Caddy & deployment bootstrap

**Intent:** Multi-stage Dockerfile (`node:24-alpine`, standalone). Two standalone compose files: `docker-compose.dev.yml` (stack `encard-dev`: Postgres only, app on host with hot reload) and `docker-compose.prod.yml` (stack `encard`: `db` (`postgres:16`) + one-shot `migrator` + `app` + internal `caddy`, bind mounts under `/home/encard/data`, `env_file`, `postgres` bind volume). Internal Caddy passes `X-Forwarded-*` through (chosen over nginx for the internal hop — a ~4-line Caddyfile with correct forwarded-header handling by default; see `docs/deploy/docker.md`). Document the production bootstrap (create `encard` user, `data/` skeleton, place `.env`). Verify secret handling and forwarded-header trust.

Out of scope: the external DMZ nginx config (infra-owned), TLS/Let's Encrypt (upstream).

## Step 10 — End-to-end critical flows & hardening

**Intent:** Playwright coverage of the three critical journeys: (a) scan/open public card → `.vcf` adds a contact; (b) login → edit `/me` → updated QR reflects the change; (c) admin disables a card → public slug returns 404. Confirm rate limiting, no-ID-leakage, and forwarded-header behavior end to end.

Out of scope: load/performance testing, visual regression.
