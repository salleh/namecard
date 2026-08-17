import { prisma } from "@/lib/prisma";
import type { EditableTextFields } from "./editableFields";

// The owner's own view of their card for the `/me` editor. Unlike PublicCard
// (repository.ts), this is NOT gated on activated/disabled — the owner may edit
// their card regardless of public visibility — and it is keyed by the caller's
// Entra object id from the authenticated session, so a signed-in user can only
// ever load their own row (no IDOR surface). Still omits internal identifiers
// (id, entraObjectId, graphSnapshot) and the raw photo bytes; the page only
// needs to know whether a photo exists (`hasPhoto`) to render the thumbnail via
// the public `/avatar/<slug>` endpoint.
export interface OwnerCard extends EditableTextFields {
  emailSlug: string;
  hasPhoto: boolean;
}

// Photo change intent for a persist: `undefined` = leave untouched,
// `null` = clear, Buffer = replace. Mirrors the PhotoUpload "keep/remove/
// replace" actions the caller resolves from the submitted form.
//
// `fields` is Partial: the caller may omit columns it must not write — notably
// admin-locked fields, which updateMyCard drops so their stored values stay
// untouched (see stripLockedFields). Omitted keys are simply left out of the
// Prisma UPDATE.
export interface OwnerCardUpdate {
  fields: Partial<EditableTextFields>;
  photo?: Buffer | null;
}

export async function getOwnerCardByEntraObjectId(
  entraObjectId: string,
): Promise<OwnerCard | null> {
  const row = await prisma.staffCard.findUnique({
    where: { entraObjectId },
    select: {
      emailSlug: true,
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
      // Select the raw photo only to derive `hasPhoto`; never returned as bytes.
      photo: true,
    },
  });

  if (!row) {
    return null;
  }

  const { photo, ...fields } = row;
  return { ...fields, hasPhoto: photo != null && photo.length > 0 };
}

// Persists an owner's edits. Writes ONLY the staff-editable columns (and the
// photo when a change is requested) — never emailSlug, activated, disabled,
// entraObjectId, or graphSnapshot — so the public URL, the activation gate, and
// the Entra linkage all stay under system/admin control. `where: entraObjectId`
// scopes the write to exactly the authenticated owner's row.
export async function updateOwnerCard(
  entraObjectId: string,
  update: OwnerCardUpdate,
): Promise<void> {
  await prisma.staffCard.update({
    where: { entraObjectId },
    data: {
      ...update.fields,
      // Prisma `Bytes` expects a plain Uint8Array<ArrayBuffer>; copy the Buffer
      // into one at the boundary (undefined = leave photo untouched).
      ...(update.photo !== undefined
        ? { photo: update.photo === null ? null : new Uint8Array(update.photo) }
        : {}),
    },
  });
}
