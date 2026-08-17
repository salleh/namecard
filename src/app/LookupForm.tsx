"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { org } from "@/config/org";
import { slugFromLookup } from "@/features/card/lookupSlug";

// Landing-page lookup: a visitor types a staff member's email name (or full
// staff email) and is routed to that staff card. Validation is client-side
// only for UX — the destination route re-validates the slug and 404s for
// unknown/unactivated staff, so nothing here is a security boundary.
export function LookupForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = slugFromLookup(value);
    if (!slug) {
      setError("Enter a valid staff email name, e.g. jane.tan");
      return;
    }
    router.push(`/${slug}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <label htmlFor="lookup" className="field-label">
        Find a staff namecard
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-stretch overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
          <input
            id="lookup"
            name="lookup"
            type="text"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="jane.tan"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "lookup-error" : undefined}
            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          <span className="hidden items-center bg-neutral-50 px-3 text-sm text-neutral-500 sm:flex">
            @{org.emailDomain}
          </span>
        </div>
        <button type="submit" className="btn btn-primary sm:px-6">
          Show card
        </button>
      </div>
      {error && (
        <p id="lookup-error" role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
