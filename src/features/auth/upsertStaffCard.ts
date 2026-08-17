import { Prisma as PrismaNamespace } from "@prisma/client";
import type { Prisma, StaffCard } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveEmailSlug } from "./emailSlug";
import { mapGraphProfileToVCardFields, type GraphMeResponse } from "./graphProfile";

export class MissingEmailSlugError extends Error {
  constructor(entraObjectId: string) {
    super(`Cannot derive a valid emailSlug for Entra object ${entraObjectId}`);
    this.name = "MissingEmailSlugError";
  }
}

// A different Entra account has already claimed this emailSlug (Prisma P2002
// unique-constraint violation on `emailSlug`). This happens when a staff
// member's local part is reissued to someone else (leaver's mailbox reused,
// re-hire, etc.) — the DB correctly refuses the duplicate rather than
// silently reassigning the public URL, but the caller MUST surface this
// loudly: left unhandled, the public slug would keep resolving to the
// former/stale card while the new hire's login silently fails to activate.
export class EmailSlugCollisionError extends Error {
  constructor(
    public readonly entraObjectId: string,
    public readonly emailSlug: string,
  ) {
    super(
      `emailSlug "${emailSlug}" is already claimed by a different Entra account ` +
        `(attempted for entraObjectId ${entraObjectId})`,
    );
    this.name = "EmailSlugCollisionError";
  }
}

function isUniqueConstraintViolation(
  error: unknown,
  target: string,
): error is PrismaNamespace.PrismaClientKnownRequestError {
  if (!(error instanceof PrismaNamespace.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== "P2002") {
    return false;
  }
  const meta = error.meta;
  const constraintTarget = meta && "target" in meta ? meta.target : undefined;
  if (Array.isArray(constraintTarget)) {
    return constraintTarget.includes(target);
  }
  return constraintTarget === target;
}

// First-login upsert, keyed by Entra object id (CLAUDE.md "Authentication &
// Data Flow" / "Data Model").
//
// Semantics (deliberately asymmetric CREATE vs UPDATE):
//   - CREATE (row doesn't exist yet): snapshot every Graph-sourced field —
//     all vCard fields, the photo, and the raw graphSnapshot — and flip
//     activated=true. This is the only time Graph data is allowed to touch
//     the staff-editable columns.
//   - UPDATE (row already exists — i.e. every subsequent login): refresh
//     ONLY `activated` (re-affirm the account is still live) and
//     `graphSnapshot` (kept current for reference/debug). vCard fields and
//     `photo` are left untouched, because CLAUDE.md states "After first
//     login, PostgreSQL is the single source of truth" — any staff edit or
//     override made via /me (Step 6) must survive re-login. Never writes
//     anything back to Entra.
export async function upsertStaffCardFromGraph(
  profile: GraphMeResponse,
  photo: Uint8Array | null,
): Promise<StaffCard> {
  const emailSlug = deriveEmailSlug(profile);
  if (!emailSlug) {
    throw new MissingEmailSlugError(profile.id);
  }

  const vCardFields = mapGraphProfileToVCardFields(profile);
  // Graph payloads are plain JSON; Prisma's Json input type doesn't include
  // `undefined`, which zod's `.optional()` fields can produce — round-trip
  // through JSON to normalize those away before persisting.
  const graphSnapshot = JSON.parse(JSON.stringify(profile)) as Prisma.InputJsonValue;

  try {
    return await prisma.staffCard.upsert({
      where: { entraObjectId: profile.id },
      create: {
        entraObjectId: profile.id,
        emailSlug,
        activated: true,
        ...vCardFields,
        photo: photo ? Buffer.from(photo) : null,
        graphSnapshot,
      },
      update: {
        activated: true,
        graphSnapshot,
      },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error, "emailSlug")) {
      throw new EmailSlugCollisionError(profile.id, emailSlug);
    }
    throw error;
  }
}
