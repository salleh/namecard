import type { PrismaClient } from "@prisma/client";
import { STAFF_CARD_FIXTURES } from "./fixtures/staffCard";

// Narrow client type so this function is reusable against either the real
// PrismaClient (CLI seed) or a test-DB-scoped client (integration tests),
// without depending on the rest of PrismaClient's surface.
type StaffCardSeedableClient = Pick<PrismaClient, "staffCard">;

// Idempotent: upserting by the unique entraObjectId means running this repeatedly
// never creates duplicate rows. NOTE: `update: fixture` intentionally re-applies
// the fixture's activated/disabled flags, so re-seeding resets a manually-toggled
// dev row back to its fixture state (expected for deterministic local fixtures).
export async function seedStaffCards(client: StaffCardSeedableClient): Promise<void> {
  for (const fixture of STAFF_CARD_FIXTURES) {
    await client.staffCard.upsert({
      where: { entraObjectId: fixture.entraObjectId },
      update: fixture,
      create: fixture,
    });
  }
}
