import type { AdminActor } from "./adminAccess";

// Security-relevant admin events worth an audit trail (CLAUDE.md Access Rules /
// plan Step 7 "Deny and audit non-member access"): every card status change,
// and every denied attempt to reach an admin surface.
export type AdminAuditEvent =
  | {
      type: "card_disabled_changed";
      actor: AdminActor;
      targetSlug: string;
      disabled: boolean;
    }
  | {
      // Admin changed the global field-lock policy (HR Request 1). `locked` is
      // the full set of locked fields after the change, so the audit line is a
      // self-contained snapshot of the new policy.
      type: "field_policy_changed";
      actor: AdminActor;
      locked: readonly string[];
    }
  | {
      // Admin edited another staff member's card via the per-employee editor
      // (HR request 3).
      type: "admin_card_edited";
      actor: AdminActor;
      targetSlug: string;
    }
  | {
      // Admin pulled a staff member's live profile from Microsoft 365 for review
      // (HR request 3). Security-relevant: the app-only Graph token can read any
      // tenant user, so every such fetch is recorded with actor + target.
      type: "admin_m365_fetch";
      actor: AdminActor;
      targetSlug: string;
    }
  | {
      type: "access_denied";
      // The identity that attempted access, when known (null = unauthenticated).
      email: string | null;
      path: string;
    };

const PREFIX = "ADMIN_AUDIT";

// Strip control chars (esp. CR/LF) from any value interpolated into a log line,
// so a malformed identity can never forge extra audit lines (log injection).
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
function safe(value: string): string {
  return value.replace(CONTROL_CHARS, "");
}

// Pure, deterministic single-line rendering — greppable `key=value` pairs, no
// timestamp (the log pipeline stamps that) and never any token/secret material.
export function formatAdminAudit(event: AdminAuditEvent): string {
  switch (event.type) {
    case "card_disabled_changed":
      return [
        PREFIX,
        `type=${event.type}`,
        `actor=${event.actor.emailSlug}`,
        `target=${event.targetSlug}`,
        `disabled=${event.disabled}`,
      ].join(" ");
    case "field_policy_changed":
      return [
        PREFIX,
        `type=${event.type}`,
        `actor=${event.actor.emailSlug}`,
        // Field names come from a fixed allowlist (never user text), so no
        // control-char stripping is needed; "<none>" makes an all-unlocked
        // policy unambiguous in the log.
        `locked=${event.locked.length > 0 ? event.locked.join(",") : "<none>"}`,
      ].join(" ");
    case "admin_card_edited":
    case "admin_m365_fetch":
      return [
        PREFIX,
        `type=${event.type}`,
        `actor=${event.actor.emailSlug}`,
        `target=${event.targetSlug}`,
      ].join(" ");
    case "access_denied":
      return [
        PREFIX,
        `type=${event.type}`,
        `email=${safe(event.email ?? "anonymous")}`,
        `path=${event.path}`,
      ].join(" ");
  }
}

// Emits the audit line. `console.warn` (stderr) keeps audit records on the same
// stream as the app's other operational logs; matches the repo's existing
// console-based logging precedent (src/auth.ts).
export function logAdminAudit(event: AdminAuditEvent): void {
  console.warn(formatAdminAudit(event));
}
