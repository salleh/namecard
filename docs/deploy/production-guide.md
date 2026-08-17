# Production Deployment Guide — e-Namecard

> **✅ Launched to production on 2026-08-04. Current release: `v1.2.0`.**
> The initial rollout is complete and the app is live. All subsequent work is a
> **hotfix / bug fix / security fix / feature enhancement**, shipped as a new
> `vX.Y.Z` tag off `main` and deployed with the redeploy steps below. See
> [§13 Post-launch hardening](#13-post-launch-hardening--known-gotchas) for the
> issues found and fixed during bring-up.

End-to-end runbook for deploying and operating the e-Namecard in production. For
the _rationale_ behind the compose/Caddy design see [`docker.md`](./docker.md);
for the Entra app registration see [`entra-app-registration.md`](./entra-app-registration.md).
This guide is the authoritative operational reference.

- **Release to deploy:** the latest `vX.Y.Z` git tag (currently **`v1.2.0`**).
- **Public URL:** `https://namecard.example.com`
- **Runtime:** Node 24 (`node:24-alpine`) · PostgreSQL 16 · Next.js standalone · internal Caddy on **port 8090**.

---

## 1. Architecture & topology

```
[ Internet ]
     │  HTTPS (TLS terminates here; Let's Encrypt)
[ DMZ nginx reverse proxy ]          ← EXTERNAL, infra-owned (not in this repo)
     │  HTTP  (internal network, X-Forwarded-Proto: https)
[ internal Caddy :8090 ] ── docker compose (stack `encard`) ──┐
     │  http://app:3000                                       │
[ app: Next.js standalone ]                                   │
     └── postgresql://db:5432 ── [ db: postgres:16 ]          │
                                  [ migrator: one-shot ]  ────┘
```

Compose services (all in `docker-compose.prod.yml`, stack name **`encard`**):

| Service    | Image / build           | Role                                      | Ports                                                     |
| ---------- | ----------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `db`       | `postgres:16`           | Database                                  | none published (internal only)                            |
| `migrator` | build target `migrator` | One-shot `prisma migrate deploy`, exits 0 | —                                                         |
| `app`      | build target `runner`   | Next.js standalone server                 | `expose 3000` (internal)                                  |
| `caddy`    | `caddy:2-alpine`        | Internal reverse proxy                    | `8090:8090` (to DMZ; avoids the host's other app on 8080) |

Startup order is enforced: `db` healthy → `migrator` completes → `app` healthy → `caddy` starts.

---

## 2. Prerequisites

### 2.1 External / infra (coordinate before deploying)

- **DNS:** `namecard.example.com` → the DMZ nginx.
- **TLS:** Let's Encrypt cert on the DMZ nginx (TLS terminates upstream; internal hop is plain HTTP).
- **DMZ nginx** forwards `namecard.example.com` → the docker host's port `8090` (internal Caddy; `80` is avoided as the host is shared with another compose app on `8080`). A baseline DMZ config + certbot runbook is in [`dmz-nginx.md`](./dmz-nginx.md). It **must**:
  - set `X-Forwarded-Proto: https` and `X-Forwarded-Host: namecard.example.com`;
  - **overwrite** (not append) any client-supplied `X-Forwarded-For` — the app's rate limiter trusts the resulting client IP.
- **Entra app registration (production):** completed per [`entra-app-registration.md`](./entra-app-registration.md). You need:
  - Application (client) ID, a client secret, and the **tenant-specific** issuer `https://login.microsoftonline.com/<tenant-id>/v2.0` (never `common`);
  - redirect URI `https://namecard.example.com/api/auth/callback/microsoft-entra-id`;
  - delegated `User.Read`; the admin **security-group object id** (groups claim / `GroupMember.Read.All` per that doc).

### 2.2 Docker host (Rocky Linux)

- Docker Engine + Compose v2, with a dedicated OS user able to run compose (see bootstrap).
- Git, and outbound network to build the images (npm registry) and pull `postgres:16` / `caddy:2-alpine`.

---

## 3. One-time host bootstrap

Run as an admin, then switch to the dedicated `encard` user. Code and state are
kept **strictly separate**: the repo clone can be wiped and re-cloned without
touching data or secrets.

```bash
# 3.1 Dedicated OS user + state skeleton
sudo useradd -m encard
sudo -iu encard                                   # become the encard user
mkdir -p /home/encard/data/postgres               # DB bind-mount + secrets live here

# 3.2 Clone the project repo (code)
git clone git@github.com:<your-org>/namecard.git /home/encard/namecard
cd /home/encard/namecard
git fetch --tags && git checkout v1.0.0           # deploy a released tag, not a moving branch

# 3.3 Create the production env file (secrets) — NEVER in the repo
cp .env.prod.example /home/encard/data/.env.prod
chmod 600 /home/encard/data/.env.prod
```

Resulting layout:

```
/home/encard/
├── namecard/            # repo clone (code) — safe to wipe & re-clone
└── data/                # state & secrets (survives redeploys)
    ├── .env.prod        # production secrets (chmod 600)
    └── postgres/        # Postgres data (bind mount)
```

---

## 4. Configure `/home/encard/data/.env.prod`

Fill every value. **Do not** leave the `CHANGE_ME` placeholders.

| Variable                              | Value                                                | Notes                                                                              |
| ------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `POSTGRES_USER`                       | `encard`                                             | DB role                                                                            |
| `POSTGRES_PASSWORD`                   | strong secret                                        | `openssl rand -base64 24`                                                          |
| `POSTGRES_DB`                         | `namecard`                                           |                                                                                    |
| `DATABASE_URL`                        | `postgresql://encard:<password>@db:5432/namecard`    | host is the compose service name `db`; password **must match** `POSTGRES_PASSWORD` |
| `AUTH_SECRET`                         | `openssl rand -base64 32`                            | signs/encrypts the session cookie                                                  |
| `AUTH_URL`                            | `https://namecard.example.com`                       | **exact** public origin — see the warning below                                    |
| `AUTH_MICROSOFT_ENTRA_APPLICATION_ID` | prod app (client) id (GUID)                          |                                                                                    |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET`      | prod client secret                                   | rotate on exposure                                                                 |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER`      | `https://login.microsoftonline.com/<tenant-id>/v2.0` | tenant-specific; **not** `common`/`organizations`/`consumers`                      |
| `ADMIN_GROUP_ID`                      | admin security-group object id (GUID)                | gates the `/admin` console                                                         |

> ⚠️ **`AUTH_URL` must be the exact public origin** — correct scheme (`https`), host,
> and **no trailing slash or typo**. It is the base for OIDC redirect URIs **and**
> for the QR's `PHOTO;VALUE=URI` avatar links. A wrong value breaks login redirects
> and makes contact photos fail to load when a QR is scanned. (This is validated at
> boot — the app refuses to start on a malformed URL — but a _reachable-but-wrong_
> host will silently misbehave.)

The app validates all required env at startup and **fails fast** with a clear
message if any are missing or malformed.

---

## 5. Deploy

From `/home/encard/namecard` as the `encard` user:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

What happens, in order:

1. **`db`** starts; healthcheck (`pg_isready`) must pass.
2. **`migrator`** builds, runs `prisma migrate deploy` against the DB, exits `0`.
   On a fresh database it applies the single consolidated `init` migration; when
   nothing is pending it exits almost immediately.
3. **`app`** starts once `migrator` succeeded and `db` is healthy; its healthcheck
   hits `/manifest.webmanifest` (public, no auth) until it returns 200.
4. **`caddy`** starts once `app` is healthy and begins proxying `:8090` → `app:3000`.

---

## 6. Post-deploy verification (smoke test)

```bash
# 6.1 All services up; app + db healthy, migrator exited 0
docker compose -f docker-compose.prod.yml ps

# 6.2 App serves through Caddy on the host (published on 8090)
curl -fsS http://localhost:8090/manifest.webmanifest | head -c 80; echo
```

Then, from a browser / phone over the public URL:

1. **Public origin reachable:** `https://namecard.example.com` loads (landing page, HTTPS valid).
2. **First login provisions a card:** sign in at `https://namecard.example.com/me` with an M365 account → your card is created (`activated=true`) and the editor shows Graph-prefilled fields.
3. **Public card + QR:** open `https://namecard.example.com/<your-email-localpart>` → details, styled QR, and the "Download contact" button render.
4. **Photo pipeline:** open `https://namecard.example.com/avatar/<your-slug>` → your image loads (if you have one). Scan the QR with a phone → contact adds; tap **Download contact (.vcf)** → the photo is embedded in the file.
5. **Admin gate:** an admin-group member sees `/admin`; a non-member is denied (and the attempt is audited).
6. **Leaver gate:** disabling a card in `/admin` makes its public slug and `.vcf` return **404**.

---

## 7. Redeploy / update

Code and state are separate, so an update is a pull + rebuild:

```bash
cd /home/encard/namecard
git fetch --tags
git checkout vX.Y.Z                                   # the new release tag
docker compose -f docker-compose.prod.yml up -d --build
```

The `migrator` runs automatically and applies any new migrations before the new
`app` starts. Zero-downtime is **not** guaranteed (single-node); expect a brief
restart. `.env.prod` and the Postgres volume are untouched by a redeploy.

---

## 8. Operations

### 8.1 Logs, status, health

```bash
docker compose -f docker-compose.prod.yml ps                 # status + health
docker compose -f docker-compose.prod.yml logs -f app        # app logs
docker compose -f docker-compose.prod.yml logs migrator      # migration output
docker compose -f docker-compose.prod.yml logs -f caddy      # proxy logs
```

### 8.2 Disable a leaver

Use the **`/admin`** console (admin-group members only): search the staff member
and toggle `disabled`. Their public card, `.vcf`, and `/avatar` immediately
return 404. No SQL/manual DB edits — Prisma is the only sanctioned DB access.

### 8.3 Database backup

The DB lives on the bind mount `/home/encard/data/postgres`. Take logical backups:

```bash
# Dump (run as encard, from the repo dir)
docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > ~/backups/namecard-$(date +%F).sql
```

Schedule this (cron) and copy off-host. Photos are stored in the DB (`bytea`), so
a logical dump captures everything.

### 8.4 Database restore

```bash
# Into a running, empty db (danger: overwrites)
cat ~/backups/namecard-YYYY-MM-DD.sql | \
  docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

---

## 9. Rollback

Releases are git tags, so rollback is a checkout + rebuild:

```bash
cd /home/encard/namecard
git checkout <previous-tag>          # e.g. v1.0.0-rc.3
docker compose -f docker-compose.prod.yml up -d --build
```

> **Schema caution:** rolling _back_ code is safe only if the DB schema is still
> compatible. Prisma migrations are forward-only — if the newer release added a
> migration, restore a pre-upgrade **DB backup** (§8.4) alongside the code
> rollback. Always snapshot the DB before an upgrade that includes a migration.

---

## 10. Troubleshooting

| Symptom                                                              | Likely cause                                                                             | Fix                                                                                                                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| App container won't start; logs show "Invalid environment variables" | Missing/malformed `.env.prod` value                                                      | Fill every var; check `AUTH_URL` is a valid URL and the issuer is tenant-specific                                                              |
| Login redirect fails / cookie not set                                | `AUTH_URL` wrong, or DMZ not sending `X-Forwarded-Proto: https`                          | Set `AUTH_URL` to the exact public origin; verify DMZ nginx forwarded headers                                                                  |
| QR-scanned contact shows initials, no photo                          | `AUTH_URL` typo/wrong host → bad avatar URL; or card has no photo; or (iOS) remote fetch | Confirm `/avatar/<slug>` loads over the public origin; fix `AUTH_URL`. Note iOS may not fetch remote QR photos — the `.vcf` download embeds it |
| `migrator` exits non-zero: history mismatch                          | DB already ran the pre-`v1.0.0` (squashed) migrations                                    | Fresh DB deploys cleanly; a reused DB must be reset (drop `/home/encard/data/postgres`, or restore a compatible backup)                        |
| `app` healthcheck never passes                                       | DB unreachable / bad `DATABASE_URL`                                                      | Ensure `DATABASE_URL` host is `db` and password matches `POSTGRES_PASSWORD`                                                                    |
| Rate limiting blocks legit users, or all traffic shares one IP       | DMZ appends instead of overwrites `X-Forwarded-For`                                      | Configure DMZ nginx to overwrite it; Caddy injects `X-Real-Client-IP` from `trusted_proxies`                                                   |
| Build fails on `npm ci` engine warning                               | Local Node < 24.18.1                                                                     | Prod builds in `node:24-alpine`; only affects host tooling — use Node 24.18.1 (`.nvmrc`)                                                       |

---

## 11. Security checklist (pre-go-live)

- [ ] `.env.prod` is `chmod 600`, owned by `encard`, and **not** in the repo.
- [ ] `POSTGRES_PASSWORD` and `AUTH_SECRET` are strong and unique to prod.
- [ ] Entra issuer is **tenant-specific** (not `common`); redirect URI matches `AUTH_URL`.
- [ ] `AUTH_URL` is the exact public HTTPS origin.
- [ ] DMZ nginx overwrites `X-Forwarded-For` and sets `X-Forwarded-Proto: https`.
- [ ] Caddy `trusted_proxies` narrowed to the DMZ IP/CIDR (currently `private_ranges` — see the Caddyfile TODO / security H-2) and its `:8090` bound to the DMZ-facing interface.
- [ ] DB `db` port is **not** published to the host (it isn't in `docker-compose.prod.yml` — keep it that way).
- [ ] Automated Postgres backups scheduled and copied off-host.
- [ ] A DB snapshot is taken before any upgrade that includes a migration.

---

## 12. Quick reference

- **Deploy:** `docker compose -f docker-compose.prod.yml up -d --build` (from `/home/encard/namecard`)
- **Env file:** `/home/encard/data/.env.prod` (secrets) · **DB data:** `/home/encard/data/postgres`
- **Public port:** host `8090` → Caddy → `app:3000` · **Public URL:** `https://namecard.example.com`
- **Stack name:** `encard` · **Release:** latest git tag (currently `v1.2.0`)
- **Validate config off-host:** `NAMECARD_PROD_ENV=.env.prod.example docker compose -f docker-compose.prod.yml config`

---

## 13. Post-launch hardening & known gotchas

Issues found and fixed during production bring-up (2026-08-03 → 08-04). Keep these
in mind for future deploys and when reviewing similar apps.

| #   | Symptom                                                                          | Root cause                                                                                                                               | Fix / where                                                                                                                       | Release         |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | DMZ nginx → app `504` connect timeout                                            | Docker's auto bridge subnet overlapped the DMZ segment (`172.16.0.0/12`), so replies to the DMZ were routed into the bridge              | Pin the compose `default` network to `172.27.1.0/24` (`docker-compose.prod.yml`)                                                  | v1.0.1          |
| 2   | `502` right after M365 login                                                     | Auth.js `Set-Cookie` headers overflow nginx's default proxy buffers                                                                      | Raise `proxy_buffer_size`/`proxy_buffers` on the DMZ nginx — see [`dmz-nginx.md`](./dmz-nginx.md)                                 | (DMZ config)    |
| 3   | `OAuthCallbackError` / `invalid_grant` on every login (worked only in Incognito) | **PWA service worker double-fetched `/api/auth/callback`**, redeeming the single-use code twice (`AADSTS54005`). Incognito disables SWs. | Exclude `/api/` from the SW and set `navigationPreload: false` (`src/app/sw.ts`)                                                  | v1.1.4          |
| 4   | Sign-out left the M365 session live (shared-PC risk)                             | App sign-out only clears the local session                                                                                               | Single "Sign out" that prompts to also end the Microsoft session via `end_session_endpoint`; sign-in uses `prompt=select_account` | v1.1.5 / v1.1.6 |

**Standing config dependencies (must remain true):**

- **Internal Caddy publishes on `8090`** (host is shared with another compose app on `8080`). The DMZ nginx upstream must target `http://<docker-host>:8090`.
- **Compose network is pinned** to `172.27.1.0/24` — do not remove; the auto-subnet collides with the DMZ.
- **DMZ nginx** must: overwrite (not append) `X-Forwarded-For`, send `X-Forwarded-Proto: https`, and carry the raised `proxy_buffer_size`.
- **Entra front-channel logout URL** = `https://namecard.example.com` is registered (needed for federated sign-out to redirect back). Registered & verified 2026-08-04.
- **Service worker must never intercept `/api/*`** — re-check this after any Serwist/`sw.ts` change.

**Deploy note:** after any change to `src/app/sw.ts`, users must pick up the new
service worker (it's `skipWaiting`/`clientsClaim`, so a reload or two suffices;
a hard refresh or DevTools → Application → Service Workers → Unregister forces it).
