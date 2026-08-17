"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { adminActorFrom } from "@/features/admin/adminAccess";
import { setCardDisabled } from "@/features/admin/adminRepository";
import { logAdminAudit } from "@/features/admin/audit";
import { parseSlug } from "@/features/card/slug";

// Toggles a staff card's public visibility. Security boundary: re-derives the
// admin identity from the session on every call (never trusts the route gate or
// client input), audits both denials and successful changes, and keys the write
// on the validated public slug. Reaching this as a non-admin performs no write.
//
// Rate limiting: this Server Action POSTs to the /admin route, which the app's
// IP rate-limit middleware (src/middleware.ts) already covers — the same
// defense-in-depth the public and /me routes get.
export async function setCardDisabledAction(formData: FormData): Promise<void> {
  const session = await auth();
  const actor = adminActorFrom(session);
  if (!actor) {
    logAdminAudit({
      type: "access_denied",
      email: session?.user?.email ?? null,
      path: "/admin (setCardDisabled)",
    });
    return;
  }

  const slug = parseSlug(String(formData.get("slug") ?? ""));
  const disabled = formData.get("disabled") === "true";
  if (!slug) {
    return;
  }

  try {
    const count = await setCardDisabled(slug, disabled);
    if (count === 0) {
      // Slug vanished between render and submit — nothing to change.
      return;
    }
  } catch (error) {
    // Log server-side; rethrow so the admin sees the operation failed rather
    // than a silent no-op. Never leaks internals (message is generic).
    console.error("setCardDisabledAction: failed to update card", error);
    throw new Error("Could not update the card.");
  }

  logAdminAudit({ type: "card_disabled_changed", actor, targetSlug: slug, disabled });
  // Refresh the console and the affected public card (which now 404s or resolves).
  revalidatePath("/admin");
  revalidatePath(`/${slug}`);
}
