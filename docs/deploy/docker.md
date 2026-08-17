# Docker & Compose — Dev and Production

Each environment has its own **standalone** compose file — no shared base, no
override merging. Pick one file per deployment:

| Environment | File                      | Stack name   |
| ----------- | ------------------------- | ------------ |
| Development | `docker-compose.dev.yml`  | `encard-dev` |
| Production  | `docker-compose.prod.yml` | `encard`     |

Separate stack names let both run side by side on a shared host without colliding.

|                    | Development (this machine)                     | Production (Rocky Linux host)           |
| ------------------ | ---------------------------------------------- | --------------------------------------- |
| App                | Runs on the **host** (`npm run dev`, fast HMR) | **In Docker** (standalone build)        |
| Services in Docker | `db` (Postgres) only                           | `db` + `migrator` + `app` + `caddy`     |
| Env file           | `.env.dev` (app **and** container)             | `/home/encard/data/.env.prod`           |
| DB volume          | named volume `pgdata`                          | bind mount `/home/encard/data/postgres` |
| Published ports    | `5432` (Postgres, for host app + tools)        | `8090` (Caddy) only                     |
| Reverse proxy      | none (host talks to app directly)              | Caddy (`:8090`, plain HTTP)             |

## Development

```bash
cp .env.dev.example .env.dev     # first time only; fill AUTH_* when doing Step 5
npm run db:up                    # start Postgres (docker compose -f docker-compose.dev.yml up -d)
npm run dev                      # app on host; loads .env.dev via dotenv-cli
```

Helpers: `npm run db:logs`, `npm run db:down` (stop), `npm run db:reset` (stop + wipe volume).

The `dev` script loads `.env.dev` with `dotenv-cli`, so a single file feeds both the
Postgres container (`env_file`) and the host app. The app connects to
`localhost:5432` (the published container port).

## Production

TLS terminates at the **external DMZ nginx** (Let's Encrypt, managed by infra); it
forwards plain HTTP to Caddy on **port 8090** with `X-Forwarded-Proto: https`. Caddy
trusts private ranges so it **preserves** those forwarded headers (needed for Auth.js
secure cookies and correct OIDC redirect URLs), then proxies to the app on `:3000`.

> **Shared host / port 8090.** The prod docker host also runs another compose app
> (a different OS user) that publishes on `8080`. To avoid collisions this stack
> publishes Caddy on **`8090`** instead of `80` — set in both
> `docker-compose.prod.yml` and `deploy/caddy/Caddyfile` (keep them in sync). The DMZ
> nginx upstream must therefore target `http://<docker-host>:8090`. A baseline DMZ
> nginx server block (pre-certbot) is provided in
> [`dmz-nginx.md`](./dmz-nginx.md).

### One-time bootstrap on the host

```bash
sudo useradd -m encard                       # dedicated OS user
sudo -iu encard
mkdir -p /home/encard/data/postgres          # state (survives redeploys)
git clone git@github.com:<your-org>/namecard.git /home/encard/namecard
cp /home/encard/namecard/.env.prod.example /home/encard/data/.env.prod
# edit /home/encard/data/.env.prod — set strong POSTGRES_PASSWORD, AUTH_SECRET,
# the PROD Entra creds, and ADMIN_GROUP_ID
```

### Deploy / redeploy

```bash
cd /home/encard/namecard
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Code (`/home/encard/namecard`) and state/secrets (`/home/encard/data`) are strictly
separated — the repo can be wiped and re-cloned without losing data or secrets.

### Database migrations

A one-shot **`migrator`** service runs `prisma migrate deploy` on every `up`, gated on
the `db` healthcheck; `app` then waits for the migrator to exit successfully
(`service_completed_successfully`), so the schema is always current before the server
starts. When nothing is pending it exits almost immediately. The migrator is a
**separate** image stage (full `npm ci`, Prisma CLI + engines) rather than an entrypoint
baked into `app`: the standalone runner ships without the Prisma CLI, and the
`migrate deploy` schema-engine is fetched per-platform by `@prisma/engines`' postinstall
(which the runtime image's `deps` stage skips). Keeping migrations in their own one-shot
service leaves the runtime image lean and avoids hand-copying engine binaries.

> **Migration history was squashed (pre-production).** The three original migrations were
> collapsed into a single `init` reflecting the final schema. A **fresh** database (new prod
> or a wiped UAT volume) applies it cleanly via `migrate deploy` — no action needed. But any
> database that already ran the _old_ migrations will report a history mismatch; reset it
> first: `npm run db:reset && npm run db:migrate` (dev), or drop/recreate the volume (prod/UAT).

### Validating prod compose locally

The prod `env_file` defaults to `/home/encard/data/.env.prod`. To validate the config
off-host, point `NAMECARD_PROD_ENV` at the sample:

```bash
NAMECARD_PROD_ENV=.env.prod.example \
  docker compose -f docker-compose.prod.yml config
```

## Why Caddy (not nginx) for the internal proxy

TLS terminates upstream, so Caddy's automatic-HTTPS is unused either way. The
deciding factor is maintainability: a ~4-line Caddyfile with correct forwarded-header
handling by default, versus nginx's `proxy_set_header` boilerplate — aligned with the
project's "minimal deps, easy to return to" principle. The external DMZ proxy remains
nginx (infra-owned); only the internal hop is Caddy.

## Notes

- Migrations are handled by the one-shot `migrator` service (see above); the `builder`
  stage runs `prisma generate` so the app image ships the generated client.
- Email is intentionally **not** provisioned (no send-email feature in scope).
