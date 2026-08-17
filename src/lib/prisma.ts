import { PrismaClient } from "@prisma/client";

// Next.js-safe global singleton: dev HMR re-executes this module on every
// edit, which would otherwise open a fresh PrismaClient (and DB connection
// pool) each time. Stash the instance on `globalThis` in non-production so
// it survives module reloads; production creates exactly one instance per
// process anyway.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

/* v8 ignore next 3 */
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
