import type { Metadata } from "next";
import Link from "next/link";
import { org } from "@/config/org";
import { LOCKABLE_FIELDS } from "@/features/card/fieldPolicy";
import { getLockedFields } from "@/features/card/fieldPolicyRepository";
import { FieldPolicyForm } from "./FieldPolicyForm";

export const metadata: Metadata = { title: `Field settings — ${org.appName}` };

// Admin field-lock config (Request 1). The /admin layout already gates this route
// to M365 admins (denials audited + 404'd), so no extra check is needed here.
export default async function FieldPolicyPage() {
  const locked = await getLockedFields();
  const initialLocked = LOCKABLE_FIELDS.filter((field) => locked.has(field));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Field settings</h1>
        <Link href="/admin" className="btn btn-ghost">
          Back to staff cards
        </Link>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Lock a field to stop staff editing it on their own card. Locked fields stay visible to staff
        with a note to contact the eNamecard admin for changes. Unlocked fields remain
        staff-editable. Nothing is locked by default.
      </p>

      <FieldPolicyForm initialLocked={initialLocked} />
    </main>
  );
}
