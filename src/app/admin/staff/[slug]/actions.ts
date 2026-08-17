"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { adminActorFrom } from "@/features/admin/adminAccess";
import { getEntraObjectIdBySlug, updateStaffCardByAdmin } from "@/features/admin/adminRepository";
import { logAdminAudit } from "@/features/admin/audit";
import { fetchGraphProfileById } from "@/features/auth/graphAppClient";
import { getAppGraphToken } from "@/features/auth/graphAppToken";
import {
  mapGraphProfileToVCardFields,
  type StaffCardVCardFields,
} from "@/features/auth/graphProfile";
import { parseCardEditForm, type CardEditFieldErrors } from "@/features/card/editSchema";
import { readPhotoUpload } from "@/features/card/photoUpload";
import { parseSlug } from "@/features/card/slug";

export type AdminEditActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string; fieldErrors?: CardEditFieldErrors };

export type AdminFetchActionState =
  | { status: "success"; fields: StaffCardVCardFields }
  | { status: "error"; message: string };

// Server Action: admin saves edits to a staff member's card (HR request 3).
// Re-derives the admin identity from the session on every call (never trusts the
// route gate or client input) and audits both denials and successful edits. The
// target is keyed on the validated public slug; admin edits are not subject to
// field locks (the admin is the authority the locks defer to).
export async function updateStaffCardByAdminAction(
  _prevState: AdminEditActionState,
  formData: FormData,
): Promise<AdminEditActionState> {
  const session = await auth();
  const actor = adminActorFrom(session);
  if (!actor) {
    logAdminAudit({
      type: "access_denied",
      email: session?.user?.email ?? null,
      path: "/admin/staff/[slug] (updateStaffCard)",
    });
    return { status: "error", message: "You are not authorized to edit this card." };
  }

  const slug = parseSlug(String(formData.get("slug") ?? ""));
  if (!slug) {
    return { status: "error", message: "Invalid card." };
  }

  const parsed = parseCardEditForm(formData);
  if (!parsed.success) {
    return { status: "error", message: "Some fields need fixing.", fieldErrors: parsed.errors };
  }

  const photo = await readPhotoUpload(formData);
  if (!photo.ok) {
    return { status: "error", message: photo.error };
  }

  try {
    const count = await updateStaffCardByAdmin(slug, {
      fields: parsed.data,
      ...(photo.action === "keep" ? {} : { photo: photo.action === "remove" ? null : photo.bytes }),
    });
    if (count === 0) {
      // Slug vanished between render and submit.
      return { status: "error", message: "This card no longer exists." };
    }
  } catch (error) {
    console.error("updateStaffCardByAdminAction: failed to persist card edit", error);
    return { status: "error", message: "Could not save the card. Please try again." };
  }

  logAdminAudit({ type: "admin_card_edited", actor, targetSlug: slug });
  revalidatePath(`/admin/staff/${slug}`);
  revalidatePath(`/${slug}`);
  return { status: "success" };
}

// Server Action: admin fetches a staff member's live Microsoft 365 profile for
// review (HR request 3) — returns the mapped vCard fields WITHOUT persisting
// (review-then-save). Nothing is written back to Entra.
//
// SECURITY-CRITICAL: the app-only Graph token can read ANY user in the tenant.
// Containment: (1) the caller must be an authenticated admin (re-checked here,
// denials audited); (2) the target's Entra object id is resolved server-side from
// an existing StaffCard row via the validated slug — never taken from client
// input — so an unknown slug yields no fetch and the tenant-wide permission can
// only ever be pointed at already-onboarded staff; (3) every fetch is audited.
export async function adminFetchFromM365Action(slugInput: string): Promise<AdminFetchActionState> {
  const session = await auth();
  const actor = adminActorFrom(session);
  if (!actor) {
    logAdminAudit({
      type: "access_denied",
      email: session?.user?.email ?? null,
      path: "/admin/staff/[slug] (fetchFromM365)",
    });
    return { status: "error", message: "You are not authorized to fetch this profile." };
  }

  const slug = parseSlug(slugInput);
  if (!slug) {
    return { status: "error", message: "Invalid card." };
  }

  // Resolve the id from OUR database, not from the client — the containment gate.
  const entraObjectId = await getEntraObjectIdBySlug(slug);
  if (!entraObjectId) {
    return { status: "error", message: "This staff member is not in the system." };
  }

  try {
    const token = await getAppGraphToken();
    const profile = await fetchGraphProfileById(entraObjectId, token);
    logAdminAudit({ type: "admin_m365_fetch", actor, targetSlug: slug });
    return { status: "success", fields: mapGraphProfileToVCardFields(profile) };
  } catch (error) {
    // Never leak Graph/token internals to the client; log server-side.
    console.error("adminFetchFromM365Action: Microsoft 365 fetch failed", error);
    return {
      status: "error",
      message: "Could not fetch this profile from Microsoft 365. Please try again later.",
    };
  }
}
