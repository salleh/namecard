# e-Namecard

A white-label PWA that displays a staff member's electronic namecard as a QR
code encoding vCard contact information. Scanning the QR (or downloading the
`.vcf`) adds the staff member to a phone's contacts — a paperless replacement
for physical namecards.

Any organization using Microsoft 365 can fork this repository, drop in its own
branding, point it at its own Entra ID tenant, and host it under its own
domain. **No application code changes are required to rebrand or redeploy** —
see [customization/README.md](customization/README.md).

Licensed under the [MIT License](LICENSE) —
© Sallehuddin Abdul Latif \<sallehuddin@gmail.com\>.

## How it works

- Staff sign in with their company Microsoft 365 account (Entra ID, OIDC). On
  first login their profile (name, title, department, phones, photo) is
  prefilled from Microsoft Graph into PostgreSQL, which then becomes the
  single source of truth — staff can override any field; nothing is ever
  written back to Entra ID.
- Each activated staff member gets a public card page at
  `https://<your-fqdn>/<email_name>` (the local part of their email), showing
  their details, a styled QR encoding the vCard, and a `.vcf` download.
- Cards resolve only after the owner has activated (first login), so email
  local parts can't be enumerated. A `disabled` flag stops cards of leavers.

## Customizing for your organization

Everything org-specific lives in one folder plus environment variables:

1. **Identity & copy** — edit [`customization/org.ts`](customization/org.ts)
   (app name, org name, email domain hint, vCard defaults, PWA colors).
2. **Colors & fonts** — edit [`customization/theme.css`](customization/theme.css)
   (the `brand-*` Tailwind palette).
3. **Logo & icons** — replace `public/brand/logo.png` and `public/icons/*`,
   then run `node scripts/make-qr-logo.mjs` to regenerate the QR overlay.
4. **Hostname (FQDN)** — set `AUTH_URL=https://namecard.example.com` in `.env`.
5. **Microsoft 365 connection** — register an Entra ID app in your tenant
   ([docs/deploy/entra-app-registration.md](docs/deploy/entra-app-registration.md))
   and set the `AUTH_MICROSOFT_ENTRA_*` variables in `.env`.

Full guide: [customization/README.md](customization/README.md).

## Stack

| Concern   | Choice                                              |
| --------- | --------------------------------------------------- |
| Framework | Next.js (App Router, TypeScript strict, standalone) |
| Database  | PostgreSQL + Prisma                                 |
| Auth      | Microsoft Entra ID via Auth.js                      |
| PWA       | Serwist                                             |
| QR        | qr-code-styling                                     |

## Prerequisites

- Node 24.18.1+ (`nvm use` — see `.nvmrc`; matches the `node:24-alpine` prod runtime).
  Avoid Node 24.17.0 — it hangs `npx playwright install` (fixed in 24.18.1).
- npm

## Getting started

```bash
npm ci                        # install deps
cp .env.dev.example .env.dev  # dev env (app + Postgres container)
npm run db:up                 # start Postgres in Docker
npm run dev                   # app on host (http://localhost:3000)
```

## Scripts

| Script                            | Purpose                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                     | Start the dev server (Webpack; Serwist SW disabled in dev) |
| `npm run build`                   | Production build (standalone output)                       |
| `npm run lint`                    | ESLint (flat config)                                       |
| `npm run typecheck`               | `tsc --noEmit`                                             |
| `npm test`                        | Vitest unit tests                                          |
| `npm run test:coverage`           | Unit tests + coverage (80% on `src/config`)                |
| `npm run test:e2e`                | Playwright smoke tests (`npx playwright install` first)    |
| `npm run format` / `format:check` | Prettier                                                   |

## User guide

For end users — how staff sign in, edit and save their card and show their QR
code, and how admins manage cards — see [docs/user-guide.md](docs/user-guide.md).

## Docker & deployment

- **Dev:** Postgres runs in Docker (`npm run db:up`); the app runs on the host.
- **Prod:** app + Postgres + Caddy via Docker Compose behind an external
  TLS-terminating reverse proxy (nginx examples included).

See [docs/deploy/docker.md](docs/deploy/docker.md) for both environments and the
production bootstrap, [docs/deploy/production-guide.md](docs/deploy/production-guide.md)
for the full production runbook, and
[docs/deploy/entra-app-registration.md](docs/deploy/entra-app-registration.md)
for the Entra setup.

## License

[MIT](LICENSE) © 2026 Sallehuddin Abdul Latif \<sallehuddin@gmail.com\>
