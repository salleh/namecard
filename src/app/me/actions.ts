"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { fetchGraphProfileById } from "@/features/auth/graphAppClient";
import { getAppGraphToken } from "@/features/auth/graphAppToken";
import {
  mapGraphProfileToVCardFields,
  type StaffCardVCardFields,
} from "@/features/auth/graphProfile";
import { parseCardEditForm, type CardEditFieldErrors } from "@/features/card/editSchema";
import { stripLockedFields } from "@/features/card/fieldPolicy";
import { getLockedFields } from "@/features/card/fieldPolicyRepository";
import { updateOwnerCard } from "@/features/card/ownerRepository";
import { readPhotoUpload } from "@/features/card/photoUpload";

export type EditActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string; fieldErrors?: CardEditFieldErrors };

export type RefreshActionState =
  | { status: "success"; fields: StaffCardVCardFields }
  | { status: "error"; message: string };

// Server Action for the `/me` editor. Trusted like any public endpoint, so it
// re-derives the owner from the session (never from client input) and validates
// every field before persisting. A signed-in user can only ever write their own
// row — `entraObjectId` comes from the encrypted session token, and the
// repository keys the UPDATE on it.
//
// Rate limiting: React Server Actions POST to the page route, so this submit
// passes through the app's IP rate-limit middleware (src/middleware.ts, whose
// matcher covers `/me`) — the same defense-in-depth the public routes get. No
// per-action limiter is duplicated here.
export async function updateMyCard(
  _prevState: EditActionState,
  formData: FormData,
): Promise<EditActionState> {
  const session = await auth();
  const entraObjectId = session?.user?.entraObjectId;
  const emailSlug = session?.user?.emailSlug;
  if (!entraObjectId || !emailSlug) {
    return { status: "error", message: "Your session has expired — please sign in again." };
  }

  const parsed = parseCardEditForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some fields need fixing.",
      fieldErrors: parsed.errors,
    };
  }

  const photo = await readPhotoUpload(formData);
  if (!photo.ok) {
    return { status: "error", message: photo.error };
  }

  // Drop any admin-locked field before persisting so its stored value is never
  // overwritten — the trust boundary for the field-lock policy. The client also
  // disables locked inputs, but a crafted POST could still include them.
  const locked = await getLockedFields();
  const fields = stripLockedFields(parsed.data, locked);

  try {
    await updateOwnerCard(entraObjectId, {
      fields,
      // keep = leave photo untouched; remove = null; replace = new bytes.
      ...(photo.action === "keep" ? {} : { photo: photo.action === "remove" ? null : photo.bytes }),
    });
  } catch (error) {
    // Never leak internals to the client; log server-side for diagnosis.
    console.error("updateMyCard: failed to persist card edit", error);
    return { status: "error", message: "Could not save your changes. Please try again." };
  }

  // Refresh both the editor and the public card so the new QR/details show
  // immediately after saving.
  revalidatePath("/me");
  revalidatePath(`/${emailSlug}`);
  return { status: "success" };
}

// Re-reads the owner's live profile from Microsoft 365 and returns the mapped
// vCard fields WITHOUT persisting — "review then save" (HR request 2): the client
// populates the form with these values for the owner to check and Save. Uses the
// app-only Graph client (the login-time delegated token isn't retained), keyed by
// the owner's Entra object id from the session, so a user can only ever refresh
// their own profile. Nothing is written back to Entra.
//
// Depends on the User.Read.All application permission + admin consent on the
// Entra app registration; until that lands, Graph returns 403 and this surfaces a
// friendly error rather than throwing.
export async function refreshFromM365Action(): Promise<RefreshActionState> {
  const session = await auth();
  const entraObjectId = session?.user?.entraObjectId;
  if (!entraObjectId) {
    return { status: "error", message: "Your session has expired — please sign in again." };
  }

  try {
    const token = await getAppGraphToken();
    const profile = await fetchGraphProfileById(entraObjectId, token);
    return { status: "success", fields: mapGraphProfileToVCardFields(profile) };
  } catch (error) {
    // Never leak Graph/token internals to the client; log server-side.
    console.error("refreshFromM365Action: Microsoft 365 fetch failed", error);
    return {
      status: "error",
      message: "Could not fetch your details from Microsoft 365. Please try again later.",
    };
  }
}
