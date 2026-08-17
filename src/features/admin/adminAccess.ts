import type { Session } from "next-auth";

// The authenticated admin's identity, captured for audit logging. All fields
// are non-sensitive (emailSlug is already the public handle; entraObjectId is
// internal but only ever written to server-side audit logs, never surfaced).
export interface AdminActor {
  entraObjectId: string;
  emailSlug: string;
  email: string | null;
}

// Pure authorization predicate. Admin membership is decided solely by the
// `isAdmin` session claim, which Step 5 computes once at sign-in from the M365
// group membership (see computeIsAdmin / docs entra-app-registration §7). No
// DB role, no per-request Graph call.
export function isAdminSession(session: Session | null | undefined): boolean {
  return session?.user?.isAdmin === true;
}

// Returns the actor identity for an authorized admin session, or null when the
// session is not an admin (or is missing the ids needed to attribute an action).
// Callers use null as the single "deny" signal.
export function adminActorFrom(session: Session | null | undefined): AdminActor | null {
  if (!isAdminSession(session) || !session) {
    return null;
  }
  const { entraObjectId, emailSlug, email } = session.user;
  if (!entraObjectId || !emailSlug) {
    return null;
  }
  return { entraObjectId, emailSlug, email: email ?? null };
}
