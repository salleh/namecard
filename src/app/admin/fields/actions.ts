"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { adminActorFrom } from "@/features/admin/adminAccess";
import { logAdminAudit } from "@/features/admin/audit";
import { parseLockedFieldsForm } from "@/features/card/fieldPolicy";
import { setLockedFields } from "@/features/card/fieldPolicyRepository";

export type FieldPolicyActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

// Server Action for the admin field-lock config (Request 1). Like every admin
// mutation it re-derives the admin identity from the session on each call — never
// trusting the route gate or client input — and audits both denials and the
// resulting policy. The /admin route (and thus this action's POST) is already
// covered by the app's IP rate-limit middleware.
export async function updateFieldPolicyAction(
  _prevState: FieldPolicyActionState,
  formData: FormData,
): Promise<FieldPolicyActionState> {
  const session = await auth();
  const actor = adminActorFrom(session);
  if (!actor) {
    logAdminAudit({
      type: "access_denied",
      email: session?.user?.email ?? null,
      path: "/admin/fields (updateFieldPolicy)",
    });
    return { status: "error", message: "You are not authorized to change field settings." };
  }

  const locked = parseLockedFieldsForm(formData);

  try {
    await setLockedFields(locked);
  } catch (error) {
    // Never leak internals to the client; log server-side for diagnosis.
    console.error("updateFieldPolicyAction: failed to persist field policy", error);
    return { status: "error", message: "Could not save field settings. Please try again." };
  }

  logAdminAudit({ type: "field_policy_changed", actor, locked });
  // Refresh the config page and the staff editor, whose locked-field notices
  // depend on this policy.
  revalidatePath("/admin/fields");
  revalidatePath("/me");
  return { status: "success" };
}
