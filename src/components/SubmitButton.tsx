"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "./Spinner";

type SubmitButtonProps = {
  children: React.ReactNode;
  // Label shown while the enclosing form's action is in flight. Defaults to
  // "Working…" so every action button gives a visible cue without extra wiring.
  pendingLabel?: string;
  className?: string;
};

// A submit button that reflects the enclosing <form>'s in-flight state via
// useFormStatus: while the server action runs it disables itself, swaps in a
// pending label, shows a spinner, and sets aria-busy so assistive tech announces
// the wait. Shared by every action form so the "something is happening" cue is
// consistent (HR request: clear UX cue on action buttons). Must be rendered as a
// descendant of the <form> whose action it submits.
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  className,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending && <Spinner />}
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}
