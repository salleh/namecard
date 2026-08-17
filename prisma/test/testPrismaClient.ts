import { PrismaClient } from "@prisma/client";

// Dedicated client for integration tests — deliberately NOT src/lib/prisma.ts's
// dev-HMR singleton, so these tests never share a connection/lifecycle with
// app code. DATABASE_URL must point at namecard_test (see .env.test.example);
// `npm run test:integration` loads that file before this module is imported.
export const testPrisma = new PrismaClient();

export async function resetStaffCards(): Promise<void> {
  await testPrisma.staffCard.deleteMany();
}

export async function resetFieldLocks(): Promise<void> {
  await testPrisma.fieldLock.deleteMany();
}
