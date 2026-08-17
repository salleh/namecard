import { prisma } from "@/lib/prisma";
import { isLockableField, type LockableField } from "./fieldPolicy";

// Persistence for the admin field-lock policy (Request 1). A `field_locks` row's
// presence means that field is locked for staff. DB-bound, so unit tests exclude
// this module (see vitest.config.ts); behavior is covered by the integration
// suite (fieldPolicyRepository.integration.test.ts).

// Returns the set of currently-locked vCard fields. An empty table (the default)
// yields an empty set — nothing locked — so production keeps its original
// all-editable behavior until an admin locks something. Any stored value that is
// no longer a known lockable field is ignored (defensive: e.g. a field retired
// from EDITABLE_TEXT_FIELDS while a stale row lingers).
export async function getLockedFields(): Promise<Set<LockableField>> {
  const rows = await prisma.fieldLock.findMany({ select: { field: true } });
  const locked = new Set<LockableField>();
  for (const row of rows) {
    if (isLockableField(row.field)) {
      locked.add(row.field);
    }
  }
  return locked;
}

// Reconciles the stored lock set to exactly `desired`: removes locks no longer
// wanted and inserts newly-requested ones, idempotently. Unknown field names are
// filtered out up-front so a malformed payload can never seed junk rows. The
// two writes run in one transaction so a reader never observes a half-applied
// policy. Empty `desired` clears all locks.
export async function setLockedFields(desired: readonly string[]): Promise<void> {
  const fields = [...new Set(desired.filter(isLockableField))];

  if (fields.length === 0) {
    await prisma.fieldLock.deleteMany({});
    return;
  }

  await prisma.$transaction([
    prisma.fieldLock.deleteMany({ where: { field: { notIn: fields } } }),
    prisma.fieldLock.createMany({
      data: fields.map((field) => ({ field })),
      skipDuplicates: true,
    }),
  ]);
}
