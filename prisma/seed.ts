import { PrismaClient } from "@prisma/client";
import { seedStaffCards } from "./seedStaffCards";

// CLI entrypoint invoked by `prisma db seed` (see prisma.config.ts). Integration
// tests call seedStaffCards() directly against a test-DB client instead.
// Excluded from coverage as a thin, environment-dependent script wrapper.
/* v8 ignore start */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedStaffCards(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
/* v8 ignore stop */
