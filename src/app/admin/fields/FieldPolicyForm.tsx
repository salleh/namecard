"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { FIELD_LABELS } from "@/features/card/editableFields";
import { LOCKABLE_FIELDS, type LockableField } from "@/features/card/fieldPolicy";
import { updateFieldPolicyAction, type FieldPolicyActionState } from "./actions";

type FieldPolicyFormProps = {
  // Fields locked at render time, in canonical order.
  initialLocked: LockableField[];
};

const INITIAL_STATE: FieldPolicyActionState = { status: "idle" };

// Admin field-lock config (Request 1). One checkbox per editable vCard field:
// checked = locked (staff cannot edit it on /me and must ask the admin). A single
// "Save field settings" button carries the pending cue via SubmitButton. The
// success banner clears the moment the admin toggles anything again, so it never
// misrepresents unsaved state.
export function FieldPolicyForm({ initialLocked }: FieldPolicyFormProps) {
  const [state, formAction] = useActionState(updateFieldPolicyAction, INITIAL_STATE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      setSaved(true);
    }
  }, [state]);

  const lockedSet = new Set(initialLocked);

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      {saved && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Field settings saved.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <fieldset className="card grid gap-1 p-2">
        <legend className="sr-only">Locked fields</legend>
        {LOCKABLE_FIELDS.map((field) => (
          <label
            key={field}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-neutral-50"
          >
            <input
              type="checkbox"
              name={`lock:${field}`}
              defaultChecked={lockedSet.has(field)}
              onChange={() => setSaved(false)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-neutral-800">{FIELD_LABELS[field]}</span>
          </label>
        ))}
      </fieldset>

      <SubmitButton pendingLabel="Saving…" className="btn btn-primary justify-self-start">
        Save field settings
      </SubmitButton>
    </form>
  );
}
