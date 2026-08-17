# e-Namecard (white-label PWA)

> **Status: open-source, white-label.** Originally built for a single company,
> now generalized so any Microsoft 365 organization can fork it, customize
> branding under `customization/`, and host it at its own FQDN. MIT licensed
> (© Sallehuddin Abdul Latif). **Invariants to preserve** (details in
> `docs/deploy/production-guide.md`): the **service worker must never intercept
> `/api/*`** (it double-redeems the OAuth code — see `src/app/sw.ts`); Entra
> front-channel logout URL registered for federated sign-out; sign-in uses
> `prompt=select_account`.

## Project Overview

A PWA/SPA web application that displays a staff member's electronic namecard as a QR code containing vCard information. Anyone scanning the QR with a phone camera can add the staff member to their contacts.

- **Public URL pattern:** `https://<fqdn>/<email_name>` — where `<email_name>` is the local part of the staff email address. Shows the staff card, a QR code encoding the vCard, and a "Download contact" (`.vcf`) button.
- **Identifier rationale:** the email local part is used instead of an internal staff ID so that no sensitive staff ID is ever exposed publicly. The email address already appears in the vCard anyway, so the slug reveals nothing new.
- **Public origin:** configured per deployment via `AUTH_URL` (e.g. `https://namecard.example.com`). Never hardcode a hostname.
- **Users:** organization staff (card owners, authenticated) and the public (card viewers, unauthenticated).

## White-label Customization (must stay true)

All org-specific identity lives outside `src/`:

- `customization/org.ts` — names, copy, email-domain hint, vCard company defaults, PWA colors. Validated by `src/config/orgSchema.ts`; exposed app-wide as `org` from `src/config/org.ts`. Client-safe — never put secrets here.
- `customization/theme.css` — the `--color-brand-*` Tailwind palette and font stack (imported by `src/app/globals.css`).
- `public/brand/logo.png`, `public/brand/qr-logo.png`, `public/icons/icon-*.png` — brand assets with fixed generic filenames. `scripts/make-qr-logo.mjs` regenerates the QR overlay from the logo; `scripts/make-brand-assets.mjs` regenerates neutral placeholders.
- FQDN and M365/Entra connection are environment variables only (`AUTH_URL`, `AUTH_MICROSOFT_ENTRA_*`, `ADMIN_GROUP_ID`).

**Never reintroduce a hardcoded org name, domain, color, or asset path into `src/`** — read from `org` / the theme instead. Server code imports `@/config` (barrel); client components import `@/config/org` directly (the barrel pulls in server-only `env`).

## Architecture

Single full-stack **Next.js** application (App Router, TypeScript). No separate backend service — all server logic lives in Next.js route handlers / server components.

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript, standalone output) |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Microsoft 365 / Entra ID via Auth.js (NextAuth) — OIDC authorization code flow |
| Directory data | Microsoft Graph API (`/me`, `/me/photo/$value`) with delegated `User.Read` scope |
| PWA | Serwist (service worker, manifest, installability) |
| Styling | Tailwind CSS v4 (CSS-first; brand tokens live in `customization/theme.css`, component classes in `src/app/globals.css`) |
| QR generation | `qr-code-styling` — QR embeds the org logo in the center |
| Deployment | Docker Compose — one standalone file per environment (`docker-compose.dev.yml` / `docker-compose.prod.yml`) |

## Authentication & Data Flow

1. Staff log in with their **company-issued M365 account** (Entra ID, OIDC via Auth.js). No local passwords.
2. **First login:** the server calls Microsoft Graph to prefill the profile — display name, given/surname, job title, department, company, email, business phone, mobile, office location, photo. The snapshot is written to PostgreSQL.
3. **After first login, PostgreSQL is the single source of truth.** Staff can fill in missing fields or **override any prefilled value**; overrides only affect the vCard shown. **Nothing is ever written back to Entra ID.**
4. The Entra object ID is the stable key linking the login to the DB row; the **email local part** (derived from the Entra `mail` attribute, lowercased) is the public URL slug. Never expose internal staff IDs in URLs, QR payloads, or page markup.

## vCard & QR Requirements

- Generate the vCard (version 3.0 — best camera-app compatibility) server-side from the PostgreSQL row. **One shared implementation** feeds both outputs:
  - The QR code on the public page encodes the **vCard text directly** (scanning offers "Add to Contacts" immediately, works offline).
  - `GET /<email_name>.vcf` serves the same vCard as `text/vcard` for the download button.
- **Deliver the photo differently per channel** (one shared `buildVCard`, two photo modes):
  - **QR → URL reference.** `PHOTO;VALUE=URI:https://<base_url>/avatar/<email_name>`, served by a public `GET /avatar/<email_name>` endpoint (same activation gate as the card page). A base64 blob would bloat the QR past scannability; a short URL keeps it lean and lets the scanning phone fetch the photo when adding the contact.
  - **`.vcf` download → embedded base64.** The file inlines the photo (`PHOTO;ENCODING=b`) so it is self-contained: importing it into an address book needs no network round trip, and base64 is the most broadly-supported `PHOTO` form for file import.
  - A card with no photo omits the `PHOTO` line entirely; the `/avatar` endpoint 404s (no placeholder). The QR's absolute origin comes from `AUTH_URL`.
- QR is styled with the org logo centered; use high error-correction level (H) to tolerate the logo overlay.

## Access Rules

- Public card pages are served **only for staff who have activated** (logged in at least once and have an `activated` flag). Unknown or unactivated `<email_name>` → 404. This matters with email-based slugs, since email local parts (names) are easier to guess than opaque IDs — the activation gate is the enumeration defense.
- A `disabled` flag lets admins stop cards of staff who leave the organization from resolving.

## Deployment Topology

Docker Compose stack on a docker host, behind an org-managed TLS-terminating reverse proxy:

```
[Internet]
    │ HTTPS (TLS terminates here)
[external reverse proxy, e.g. DMZ nginx]  ← EXTERNAL DEPENDENCY, not part of this stack
    │ HTTP (internal network)
[internal Caddy]  ── docker compose ──┬── [app: Next.js standalone]
                                      └── [db: postgresql]
```

Compose services (this repo owns these):

1. `app` — Next.js standalone build, `node:24-alpine`, multi-stage Dockerfile.
2. `db` — `postgres:16`, data persisted via bind mounts (see Production Deployment Pattern).
3. `caddy` — internal Caddy reverse proxy in front of the app container (a ~4-line Caddyfile handles forwarded headers correctly by default — see `docs/deploy/docker.md`).
4. `migrator` — one-shot `prisma migrate deploy` (prod only); `app` waits for it to finish before starting.

External dependency (managed by the deploying org, config examples in `docs/deploy/dmz-nginx.md`):

- A reverse proxy forwards the chosen FQDN to the internal Caddy and handles **TLS** (e.g. Let's Encrypt). Internal traffic is plain HTTP.
- Because TLS terminates upstream, the app must trust `X-Forwarded-Proto` / `X-Forwarded-Host`; set `AUTH_URL` to the public HTTPS origin so OIDC redirects and cookies (Secure, httpOnly) are generated for it. The internal Caddy must pass the forwarded headers through.

Dev vs production: two standalone compose files. Dev uses `docker-compose.dev.yml` (Postgres only — the app runs on the host with hot reload against a dev Entra app registration). Production uses `docker-compose.prod.yml` (full `db` + `migrator` + `app` + `caddy` stack).

## Production Deployment Pattern

On the production docker host:

1. The app runs under a **dedicated OS user** (the docs use `encard`) with home directory `/home/encard`. All containers, files, and compose commands for this app belong to that user.
2. Two core folders inside the user's home:
   - **`/home/encard/namecard`** — the deployed project repository (git clone). Compose files are run from here; deployments are `git pull` + rebuild/restart.
   - **`/home/encard/data`** — base directory for all runtime state and configuration that must survive redeployments: `.env` file(s) with production secrets (never in the repo), the PostgreSQL bind-mount volume, and any other required volumes.

Implications for the compose files:

- Production compose must reference the env file and volumes under `/home/encard/data` (bind mounts, not anonymous/named volumes).
- Code and state are strictly separated: wiping and re-cloning the repo must never lose data or secrets.
- Bootstrap steps (create the OS user, create `data/` skeleton, place `.env`) are documented in `docs/deploy/`.

## Data Model (starting point)

`StaffCard`
- `id` (uuid, pk)
- `entraObjectId` (unique — links to the M365 identity)
- `emailSlug` (unique — public URL slug; local part of the staff email, lowercased. No internal staff ID is stored or exposed)
- `activated` (bool, default false → true on first login)
- `disabled` (bool, default false)
- vCard fields: `displayName`, `givenName`, `surname`, `jobTitle`, `department`, `company`, `email`, `businessPhone`, `mobilePhone`, `officeLocation`, `address`, `website`, plus any extra staff-fillable fields
- `photo` (bytea — `.vcf` embeds it; QR references `/avatar/<slug>`)
- `graphSnapshot` (jsonb — raw first-login Graph payload, for reference/debug)
- `createdAt`, `updatedAt`

## Environment Variables

- `DATABASE_URL` — Prisma/PostgreSQL connection string
- `AUTH_MICROSOFT_ENTRA_APPLICATION_ID` / `AUTH_MICROSOFT_ENTRA_ID_SECRET` / `AUTH_MICROSOFT_ENTRA_ID_ISSUER` — Entra app registration (tenant-specific issuer, NOT `common`)
- `AUTH_SECRET` — Auth.js session encryption
- `AUTH_URL` — the deployment's public origin, e.g. `https://namecard.example.com`
- `ADMIN_GROUP_ID` — object ID of the M365 security group admitted to `/admin`
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — db container

Never commit secrets; use `.env` files excluded from git, with committed `.env*.example` templates.

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/<email_name>` | Public (SSR) | Card page: details, styled QR, download button |
| `/<email_name>.vcf` | Public | vCard file download (`text/vcard`) |
| `/avatar/<email_name>` | Public | Staff photo image (`image/*`), referenced by the vCard `PHOTO;VALUE=URI`. 404 when unactivated/disabled/photoless |
| `/me` | Authenticated | Edit own card: prefilled fields, overrides, preview |
| `/admin` | Admin group | Staff card administration |
| `/api/auth/*` | — | Auth.js OIDC handlers |
| `/manifest.webmanifest`, service worker | Public | PWA assets |

## Conventions

- TypeScript strict mode everywhere.
- Prisma migrations committed to the repo (`prisma migrate`); never edit the DB by hand.
- Keep dependency count minimal — this app should be easy to return to after months untouched.
- PWA niceties: cache the logged-in user's own card for offline display of their QR.

## Non-Goals

- No write-back of any data to Entra ID / M365.
- No public directory/search page — cards are reachable only by knowing the `<email_name>` URL.
- No internal staff IDs anywhere in public-facing URLs, payloads, or markup.
- No self-registration — only company M365 accounts can log in.
- No multi-tenancy in one deployment — one deployment serves one organization; a different org forks and hosts its own instance.
