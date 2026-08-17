"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { QrCard } from "@/app/[slug]/QrCard";
import { Spinner } from "@/components/Spinner";
import {
  EDITABLE_TEXT_FIELDS,
  FIELD_LABELS,
  type EditableTextField,
  type EditableTextFields,
} from "@/features/card/editableFields";
import { avatarUrl } from "@/features/card/avatarUrl";
import { cacheOwnCard } from "@/features/pwa/ownCard";
import { buildQrCodeOptions } from "@/features/qr";
import { refreshFromM365Action, updateMyCard, type EditActionState } from "./actions";

// Input type per editable field. Labels come from the shared FIELD_LABELS (one
// source of truth, also used by the admin field-lock config); only the HTML
// input type is local to this editor.
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

interface EditFormProps {
  initial: EditableTextFields;
  slug: string;
  hasPhoto: boolean;
  // Canonical public origin (env.AUTH_URL), passed from the server so the
  // preview QR's PHOTO URI is absolute without reaching for `window`.
  origin: string;
  // Fields the admin has locked (HR request 2). Rendered read-only with a notice
  // to contact the admin; also enforced server-side in updateMyCard.
  lockedFields: EditableTextField[];
}

const INITIAL_STATE: EditActionState = { status: "idle" };

// Builds a value for every editable field from a per-field mapper — the one
// place the `EDITABLE_TEXT_FIELDS` iteration + typed-record construction lives.
function buildFields<V>(map: (field: EditableTextField) => V): Record<EditableTextField, V> {
  const out = {} as Record<EditableTextField, V>;
  for (const field of EDITABLE_TEXT_FIELDS) {
    out[field] = map(field);
  }
  return out;
}

const toFieldValues = (initial: EditableTextFields): FieldValues =>
  buildFields((field) => initial[field] ?? "");

// Maps the current (possibly unsaved) form values into the VCardInput the QR
// builder consumes, so the preview reflects edits live as the user types. The
// photo is not part of this shape — it rides in the QR as a URL (PHOTO;VALUE=URI)
// passed separately, reflecting the last *saved* photo, not an unsaved pick.
const toVCardInput = (values: FieldValues): EditableTextFields =>
  buildFields((field) => {
    const trimmed = values[field].trim();
    return trimmed.length === 0 ? null : trimmed;
  });

export function EditForm({ initial, slug, hasPhoto, origin, lockedFields }: EditFormProps) {
  const [state, formAction, isPending] = useActionState(updateMyCard, INITIAL_STATE);
  const [values, setValues] = useState<FieldValues>(() => toFieldValues(initial));
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // M365 refresh runs as a transition (not a form submit), so useTransition gives
  // the in-flight cue directly. `refreshNote` holds the review-then-save result.
  const [isRefreshing, startRefresh] = useTransition();
  const [refreshNote, setRefreshNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const lockedSet = useMemo(() => new Set<EditableTextField>(lockedFields), [lockedFields]);
  // Whether to show the "saved" banner. Set true when the action succeeds,
  // cleared as soon as the user edits again so the banner never lies about the
  // current (now-unsaved) state. We deliberately do NOT resync `values` from a
  // revalidated `initial` prop — the inputs already hold what was just saved,
  // and overwriting them would clobber anything typed during the save.
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      setSaved(true);
    }
  }, [state]);

  // Precache the owner's own card for offline QR display (Step 8), and refresh
  // that cache after every successful save so an edited card is what shows up
  // offline. Best-effort — no-ops where Cache Storage is unavailable.
  useEffect(() => {
    void cacheOwnCard(slug);
  }, [slug, state]);

  // Revoke the previous object URL whenever the preview changes or the form
  // unmounts, so picking several photos in a row doesn't leak blob URLs.
  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const previewPhotoUrl = hasPhoto ? avatarUrl(origin, slug) : undefined;
  const qrOptions = useMemo(
    () => buildQrCodeOptions(toVCardInput(values), previewPhotoUrl),
    [values, previewPhotoUrl],
  );
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  function handleChange(field: EditableTextField, value: string) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSaved(false);
    const file = event.target.files?.[0];
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  // Fetch the owner's live M365 profile and load it into the form for review —
  // does not persist until the owner clicks Save. Locked fields are never
  // touched (they stay as the admin set them); `website` has no Graph source so
  // the action simply omits it. Refreshing counts as an edit, so clear "saved".
  function handleRefresh() {
    setRefreshNote(null);
    startRefresh(async () => {
      const result = await refreshFromM365Action();
      if (result.status === "error") {
        setRefreshNote({ kind: "err", text: result.message });
        return;
      }
      setSaved(false);
      setValues((prev) => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(result.fields)) {
          const field = key as EditableTextField;
          if (lockedSet.has(field)) continue;
          next[field] = value ?? "";
        }
        return next;
      });
      setRefreshNote({
        kind: "ok",
        text: "Loaded from Microsoft 365. Review the fields and click Save changes to keep them.",
      });
    });
  }

  // Current photo shown on the page: a freshly-picked file wins; otherwise the
  // saved avatar. Relative path (not the absolute QR origin) so it always loads
  // from the current host.
  const currentPhotoSrc = photoPreview ?? (hasPhoto ? `/avatar/${slug}` : null);

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_18rem]">
      <form action={formAction} className="grid gap-3">
        {saved && (
          <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Your card has been updated.
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
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            className="btn btn-secondary"
          >
            {isRefreshing && <Spinner />}
            <span>
              {isRefreshing ? "Fetching from Microsoft 365…" : "Refresh from Microsoft 365"}
            </span>
          </button>
          <span className="text-xs text-neutral-500">
            Loads your latest details from Microsoft 365 for review — nothing is saved until you
            click Save changes.
          </span>
        </div>
        {refreshNote && (
          <p
            role={refreshNote.kind === "err" ? "alert" : "status"}
            className={
              refreshNote.kind === "err"
                ? "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                : "rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700"
            }
          >
            {refreshNote.text}
          </p>
        )}

        {EDITABLE_TEXT_FIELDS.map((field) => {
          const error = fieldErrors[field];
          const isLocked = lockedSet.has(field);
          const noteId = isLocked ? `${field}-lock-note` : undefined;
          return (
            <label key={field} className="grid gap-1">
              <span className="field-label">
                {FIELD_LABELS[field]}
                {isLocked && (
                  <span className="ml-2 align-middle text-xs font-normal text-neutral-500">
                    🔒 Locked
                  </span>
                )}
              </span>
              <input
                name={field}
                type={FIELD_TYPES[field]}
                value={values[field]}
                onChange={(e) => handleChange(field, e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={noteId}
                disabled={isLocked}
                className="input disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
              />
              {isLocked && (
                <span id={noteId} className="text-xs text-neutral-500">
                  This field is locked by the eNamecard admin. Contact the eNamecard admin to change
                  it.
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

        <button type="submit" disabled={isPending} className="btn btn-primary justify-self-start">
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <aside aria-label="Live preview" className="md:sticky md:top-6 md:self-start">
        <div className="card p-4 text-center">
          <h2 className="text-sm font-semibold text-neutral-700">Live preview</h2>
          {currentPhotoSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- avatar endpoint / local object URL
            <img
              src={currentPhotoSrc}
              alt="Card photo preview"
              width={96}
              height={96}
              className="mx-auto mt-3 h-24 w-24 rounded-full object-cover"
            />
          )}
          <p className="mt-2 font-semibold text-neutral-900">
            {values.displayName.trim() || "Staff member"}
          </p>
          <div className="mt-3 rounded-xl bg-neutral-50 p-3">
            <QrCard options={qrOptions} />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Public card: <code className="rounded bg-neutral-100 px-1">/{slug}</code>
          </p>
        </div>
      </aside>
    </div>
  );
}
