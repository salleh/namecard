# syntax=docker/dockerfile:1

# ---- deps: install deps WITHOUT lifecycle scripts (prisma schema not copied yet) ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts skips the `postinstall: prisma generate` hook here; the
# client is generated in the builder stage once the schema is present.
RUN npm ci --ignore-scripts

# ---- builder: generate the Prisma client + compile the standalone Next.js output ----
FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# These are validated (not used) at build time by src/config/env.ts's eager
# parse — Next.js evaluates src/auth.ts (and everything that imports it, e.g.
# the API route handler and the home page) while collecting page data during
# `next build`. Placeholders satisfy the zod schema; none of these are real
# credentials, and the real values are injected at runtime via env_file.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    AUTH_SECRET=placeholder-build-time-secret-value-only \
    AUTH_URL=http://localhost:3000 \
    AUTH_MICROSOFT_ENTRA_APPLICATION_ID=00000000-0000-0000-0000-000000000000 \
    AUTH_MICROSOFT_ENTRA_ID_SECRET=placeholder \
    AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0 \
    ADMIN_GROUP_ID=00000000-0000-0000-0000-000000000000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- migrator: one-shot `prisma migrate deploy` runner ----
# Kept separate from `runner` on purpose: the standalone output does NOT include
# the Prisma CLI, and the schema-engine that `migrate deploy` needs is fetched
# per-platform by @prisma/engines' postinstall (which the `deps` stage skips via
# --ignore-scripts). Rather than hand-copy the musl schema-engine into the lean
# runtime image, this stage does a full `npm ci` (lifecycle scripts ON) so the
# correct linux-musl engines install normally. Compose runs it once before `app`.
FROM node:24-alpine AS migrator
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Scripts ON so @prisma/engines fetches the linux-musl schema-engine.
RUN npm ci
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- runner: minimal production image ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs
# Standalone server + its static assets + public (incl. generated sw.js).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# Migrations run in the separate one-shot `migrator` stage/service (compose gates
# this `app` on its successful completion), so the runtime image stays lean and
# free of the Prisma CLI. This container only serves the app.
CMD ["node", "server.js"]
