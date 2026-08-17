"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Spinner } from "@/components/Spinner";
import { SubmitButton } from "@/components/SubmitButton";
import {
  EDITABLE_TEXT_FIELDS,
  FIELD_LABELS,
  type EditableTextField,
  type EditableTextFields,
} from "@/features/card/editableFields";
import {
  adminFetchFromM365Action,
  updateStaffCardByAdminAction,
  type AdminEditActionState,
} from "./actions";

const FIELD_TYPES: Record<EditableTextField, "text" | "email" | "tel" | "url"> = {
  displayName: "text",
  givenName: "text",
  surname: "text",
  jobTitle: "text",
  department: "text",
  company: "text",
  email: "email",
  businessPhone: "tel",
  mobilePhone: "tel",
  faxNumber: "tel",
  officeLocation: "text",
  address: "text",
  website: "url",
};

type FieldValues = Record<EditableTextField, string>;
// M365 values are a subset of editable fields (Graph has no `website` source).
type M365Values = Partial<Record<EditableTextField, string | null>>;

interface AdminEditFormProps {
  slug: string;
  initial: EditableTextFields;
  hasPhoto: boolean;
}

const INITIAL_STATE: AdminEditActionState = { status: "idle" };

function toFieldValues(initial: EditableTextFields): FieldValues {
  const out = {} as FieldValues;
  for (const field of EDITABLE_TEXT_FIELDS) {
    out[field] = initial[field] ?? "";
  }
  return out;
}

// Admin per-employee editor (HR request 3). Admin may edit every field (no field
// locks apply). "Fetch from Microsoft 365" pulls the target's live profile ONCE
// and shows each value as a suggestion; the admin applies suggestions per field
// or all at once, then Saves (review-then-save — nothing persists until Save).
export function AdminEditForm({ slug, initial, hasPhoto }: AdminEditFormProps) {
  const [state, formAction] = useActionState(updateStaffCardByAdminAction, INITIAL_STATE);
  const [values, setValues] = useState<FieldValues>(() => toFieldValues(initial));
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isFetching, startFetch] = useTransition();
  const [m365, setM365] = useState<M365Values | null>(null);
  const [fetchNote, setFetchNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      setSaved(true);
    }
  }, [state]);

  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const currentPhotoSrc = photoPreview ?? (hasPhoto ? `/avatar/${slug}` : null);

  function handleChange(field: EditableTextField, value: string) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSaved(false);
    const file = event.target.files?.[0];
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  // Single Graph round-trip; the result is cached as per-field suggestions.
  function handleFetch() {
    setFetchNote(null);
    startFetch(async () => {
      const result = await adminFetchFromM365Action(slug);
      if (result.status === "error") {
        setFetchNote({ kind: "err", text: result.message });
        return;
      }
      setM365(result.fields);
      setFetchNote({
        kind: "ok",
        text: "Loaded from Microsoft 365. Apply the values you want, then click Save changes.",
      });
    });
  }

  function applyField(field: EditableTextField) {
    const suggested = m365?.[field];
    if (suggested === undefined) return;
    setSaved(false);
    setValues((prev) => ({ ...prev, [field]: suggested ?? "" }));
  }

  function applyAll() {
    if (!m365) return;
    setSaved(false);
    setValues((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(m365)) {
        next[key as EditableTextField] = value ?? "";
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="mt-6 grid gap-3">
      <input type="hidden" name="slug" value={slug} />

      {saved && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Card saved.
        </p>
      )}
      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-50 px-3 py-2.5">
        <button
          type="button"
          onClick={handleFetch}
          disabled={isFetching}
          aria-busy={isFetching}
          className="btn btn-secondary"
        >
          {isFetching && <Spinner />}
          <span>{isFetching ? "Fetching from Microsoft 365…" : "Fetch from Microsoft 365"}</span>
        </button>
        {m365 && (
          <button type="button" onClick={applyAll} className="btn btn-ghost">
            Apply all
          </button>
        )}
        <span className="text-xs text-neutral-500">
          Loads this staff member&apos;s Microsoft 365 profile for review — nothing is saved until
          you click Save changes.
        </span>
      </div>
      {fetchNote && (
        <p
          role={fetchNote.kind === "err" ? "alert" : "status"}
          className={
            fetchNote.kind === "err"
              ? "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              : "rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700"
          }
        >
          {fetchNote.text}
        </p>
      )}

      {EDITABLE_TEXT_FIELDS.map((field) => {
        const error = fieldErrors[field];
        const suggested = m365?.[field];
        const suggestionText = suggested === undefined ? null : suggested === null ? "" : suggested;
        const showSuggestion = suggestionText !== null && suggestionText !== values[field];
        return (
          <label key={field} className="grid gap-1">
            <span className="field-label">{FIELD_LABELS[field]}</span>
            <input
              name={field}
              type={FIELD_TYPES[field]}
              value={values[field]}
              onChange={(e) => handleChange(field, e.target.value)}
              aria-invalid={error ? true : undefined}
              className="input"
            />
            {showSuggestion && (
              <span className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                Microsoft 365: <span className="font-medium">{suggestionText || "(empty)"}</span>
                <button
                  type="button"
                  onClick={() => applyField(field)}
                  className="rounded border border-neutral-300 px-1.5 py-0.5 font-medium text-brand-700 hover:bg-brand-50"
                >
                  Apply
                </button>
              </span>
            )}
            {error && (
              <span role="alert" className="text-sm text-red-600">
                {error}
              </span>
            )}
          </label>
        );
      })}

      <fieldset className="rounded-lg border border-neutral-200 p-3">
        <legend className="field-label px-1">Photo</legend>
        {currentPhotoSrc && (
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- avatar endpoint / local object URL */}
            <img
              src={currentPhotoSrc}
              alt="Current photo"
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover ring-1 ring-neutral-200"
            />
            <span className="text-xs text-neutral-500">
              {photoPreview ? "New photo (unsaved)" : "Current photo"}
            </span>
          </div>
        )}
        <input
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/gif"
          onChange={handlePhotoChange}
          className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
        />
        {hasPhoto && (
          <label className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
            <input name="removePhoto" type="checkbox" /> Remove current photo
          </label>
        )}
      </fieldset>

      <SubmitButton pendingLabel="Saving…" className="btn btn-primary justify-self-start">
        Save changes
      </SubmitButton>
    </form>
  );
}
