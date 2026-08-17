"use client";

import { useEffect, useState } from "react";
import { signOutApp, signOutMicrosoft } from "@/features/auth/logoutActions";

type Props = {
  // Styling for the trigger button so it matches its context (header vs page).
  className?: string;
};

// A single "Sign out" control. Clicking it doesn't sign out immediately —
// it asks whether to ALSO end the Microsoft session, so a user on a shared
// computer makes a deliberate choice instead of leaving M365 signed in.
export function SignOutButton({ className = "btn btn-ghost" }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape while the dialog is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button type="button" className={className} onClick={() => setIsOpen(true)}>
        Sign out
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-left shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="signout-dialog-title" className="text-lg font-semibold text-neutral-900">
              Sign out
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Do you also want to sign out of your Microsoft account? Recommended on shared or
              public computers, so no one can sign back in as you.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <form action={signOutMicrosoft}>
                <button type="submit" className="btn btn-primary w-full" autoFocus>
                  Yes, sign out of Microsoft too
                </button>
              </form>
              <form action={signOutApp}>
                <button type="submit" className="btn btn-secondary w-full">
                  No, just this app
                </button>
              </form>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
