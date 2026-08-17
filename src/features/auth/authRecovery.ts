// Self-healing for poisoned Auth.js OAuth-flow cookies.
//
// When the cookie prefix flips (e.g. an HTTP-context deploy sets plain
// `authjs.*` cookies, then an HTTPS deploy sets `__Secure-`/`__Host-` ones), a
// browser ends up holding BOTH variants. Auth.js reads by name and the stale
// duplicate can win, breaking the PKCE/state/CSRF check on the next login with
// `OAuthCallbackError` (`invalid_grant`). The fix here purges those flow cookies
// and restarts sign-in once, so users never have to clear cookies by hand.
//
// These are pure helpers (no request/cookie context) so they unit-test cleanly;
// the request-side wiring lives in src/app/auth/recover/page.tsx and src/auth.ts.

// Auth.js v5 error codes that indicate a broken OAuth *flow* (cookie/state/PKCE
// mismatch or a rejected code exchange) — the class of failure a single clean
// retry recovers from. A genuine misconfiguration simply fails again and is
// caught by the one-shot retry marker, so it can never loop.
export const RECOVERABLE_AUTH_ERRORS = ["OAuthCallbackError", "Callback"] as const;

export function isRecoverableAuthError(code: string | null | undefined): boolean {
  if (!code) return false;
  return (RECOVERABLE_AUTH_ERRORS as readonly string[]).includes(code);
}

// Base names of the Auth.js OAuth *flow* cookies (v5 defaults). The
// session-token is deliberately excluded: a user mid-login has no session worth
// preserving, and leaving it alone keeps the blast radius small.
const AUTH_FLOW_COOKIE_BASENAMES = [
  "authjs.csrf-token",
  "authjs.callback-url",
  "authjs.state",
  "authjs.pkce.code_verifier",
  "authjs.nonce",
] as const;

// Every plausible variant of each flow cookie — plain plus both secure prefixes
// — so a stale cookie set under ANY past config is expired regardless of the
// prefix it carried. Deleting a cookie that doesn't exist is a harmless no-op.
export function authFlowCookieNames(): string[] {
  const names = new Set<string>();
  for (const base of AUTH_FLOW_COOKIE_BASENAMES) {
    names.add(base);
    names.add(`__Secure-${base}`);
    names.add(`__Host-${base}`);
  }
  return [...names];
}

// Short-lived marker so a genuinely-failing login is retried at most once before
// we show a real error page, instead of bouncing between the provider forever.
export const RECOVER_MARKER_COOKIE = "authjs.recover-attempted";
export const RECOVER_MARKER_MAX_AGE_SECONDS = 120;

// Whether cookies for this deployment should carry the Secure flag. Pinned to
// the configured AUTH_URL (not per-request proxy headers) so the prefix is
// deterministic and cannot flip between requests — the root-cause prevention.
// Falls back to false for an unparseable value so local HTTP dev still works.
export function isSecureOrigin(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
