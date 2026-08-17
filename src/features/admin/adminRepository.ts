import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EditableTextFields } from "@/features/card/editableFields";
import type { OwnerCardUpdate } from "@/features/card/ownerRepository";

// A staff row for the admin console. Deliberately omits internal identifiers
// (id, entraObjectId, graphSnapshot) and the photo — CLAUDE.md "no internal
// staff IDs surfaced". emailSlug is the public, non-sensitive handle the admin
// UI keys actions off.
export interface AdminStaffRow {
  emailSlug: string;
  displayName: string | null;
  jobTitle: string | null;
  department: string | null;
  email: string | null;
  activated: boolean;
  disabled: boolean;
}

// Cap the result set so the console can never issue an unbounded scan.
const MAX_ROWS = 200;

const ROW_SELECT = {
  emailSlug: true,
  displayName: true,
  jobTitle: true,
  department: true,
  email: true,
  activated: true,
  disabled: true,
} satisfies Prisma.StaffCardSelect;

// Lists activated staff cards (plan Step 7: "list/search activated staff"),
// optionally filtered by a normalized, case-insensitive needle across the
// visible identity fields. Disabled cards stay in the list so an admin can
// re-enable a card; unactivated cards are excluded (they have no public URL yet).
export async function listStaffCards(search: string): Promise<AdminStaffRow[]> {
  const where: Prisma.StaffCardWhereInput = { activated: true };
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: "insensitive" } },
      { emailSlug: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { department: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.staffCard.findMany({
    where,
    select: ROW_SELECT,
    orderBy: [{ displayName: "asc" }, { emailSlug: "asc" }],
    take: MAX_ROWS,
  });
}

// Toggles a card's `disabled` flag by its public slug (never an internal id) so
// a leaver's card stops (or resumes) resolving publicly. Uses updateMany so an
// unknown slug is a no-op returning 0 rather than throwing — the caller turns 0
// into a "not found" audit/response.
export async function setCardDisabled(emailSlug: string, disabled: boolean): Promise<number> {
  const result = await prisma.staffCard.updateMany({
    where: { emailSlug },
    data: { disabled },
  });
  return result.count;
}

// The admin per-employee editor's view of a card (HR request 3). Full editable
// fields keyed by the public slug — admin may edit a card regardless of
// activated/disabled. Still omits internal identifiers (id, entraObjectId,
// graphSnapshot) and the raw photo bytes; the page only needs `hasPhoto` to
// render the thumbnail via the public `/avatar/<slug>` endpoint.
export interface AdminEditableCard extends EditableTextFields {
  emailSlug: string;
  disabled: boolean;
  hasPhoto: boolean;
}

const EDIT_SELECT = {
  emailSlug: true,
  disabled: true,
  displayName: true,
  givenName: true,
  surname: true,
  jobTitle: true,
  department: true,
  company: true,
  email: true,
  businessPhone: true,
  mobilePhone: true,
  faxNumber: true,
  officeLocation: true,
  address: true,
  website: true,
  // Selected only to derive `hasPhoto`; never returned as bytes.
  photo: true,
} satisfies Prisma.StaffCardSelect;

// Loads a single card for the admin editor by its public slug. Returns null for
// an unknown slug (the page 404s). No activated/disabled filter — an admin may
// edit any existing card.
export async function getStaffCardForEdit(emailSlug: string): Promise<AdminEditableCard | null> {
  const row = await prisma.staffCard.findUnique({ where: { emailSlug }, select: EDIT_SELECT });
  if (!row) {
    return null;
  }
  const { photo, ...fields } = row;
  return { ...fields, hasPhoto: photo != null && photo.length > 0 };
}

// SECURITY-CRITICAL: resolves a public slug to the staff member's Entra object
// id, server-side only, for the admin "fetch from Microsoft 365" flow. The
// app-only Graph token can read ANY user in the tenant, so the target id must
// come from an existing StaffCard row (an already-onboarded staff member) — never
// from client input. An unknown slug returns null, so the tenant-wide permission
// can never be pointed at an arbitrary directory user through this app. The id is
// used only to call Graph and is never returned to the browser.
export async function getEntraObjectIdBySlug(emailSlug: string): Promise<string | null> {
  const row = await prisma.staffCard.findUnique({
    where: { emailSlug },
    select: { entraObjectId: true },
  });
  return row?.entraObjectId ?? null;
}

// Persists an admin's edits to a card by its public slug. Writes only the
// editable columns (and the photo when a change is requested) — never emailSlug,
// activated, disabled, entraObjectId, or graphSnapshot. Uses updateMany so an
// unknown slug is a no-op returning 0 (the caller turns 0 into "not found").
// Admin edits are not subject to field locks — the admin is the authority the
// locks defer staff to.
export async function updateStaffCardByAdmin(
  emailSlug: string,
  update: OwnerCardUpdate,
): Promise<number> {
  const result = await prisma.staffCard.updateMany({
    where: { emailSlug },
    data: {
      ...update.fields,
      ...(update.photo !== undefined
        ? { photo: update.photo === null ? null : new Uint8Array(update.photo) }
        : {}),
    },
  });
  return result.count;
}
