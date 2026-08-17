"use client";

import { useEffect, useRef } from "react";

type Props = {
  // A server action passed down from the recover page. Submitting the form runs
  // it, which purges the stale flow cookies and restarts sign-in.
  action: () => void | Promise<void>;
};

// Auto-submits the recovery form on mount so the retry is invisible to the user.
// A <noscript> submit button keeps it usable without JavaScript.
export function AutoSubmit({ action }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={action}>
      <noscript>
        <button type="submit" className="btn btn-primary">
          Continue sign-in
        </button>
      </noscript>
    </form>
  );
}
