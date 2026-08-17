import { describe, expect, it } from "vitest";
import {
  RECOVERABLE_AUTH_ERRORS,
  RECOVER_MARKER_COOKIE,
  RECOVER_MARKER_MAX_AGE_SECONDS,
  authFlowCookieNames,
  isRecoverableAuthError,
  isSecureOrigin,
} from "./authRecovery";

describe("isRecoverableAuthError", () => {
  it("returns true for the OAuth flow errors a clean retry can fix", () => {
    for (const code of RECOVERABLE_AUTH_ERRORS) {
      expect(isRecoverableAuthError(code)).toBe(true);
    }
  });

  it("returns false for missing error codes", () => {
    expect(isRecoverableAuthError(null)).toBe(false);
    expect(isRecoverableAuthError(undefined)).toBe(false);
    expect(isRecoverableAuthError("")).toBe(false);
  });

  it("returns false for non-flow errors that retrying would not fix", () => {
    // AccessDenied (user declined) and Configuration (server misconfig) must
    // not trigger an automatic retry.
    expect(isRecoverableAuthError("AccessDenied")).toBe(false);
    expect(isRecoverableAuthError("Configuration")).toBe(false);
    expect(isRecoverableAuthError("Verification")).toBe(false);
  });
});

describe("authFlowCookieNames", () => {
  it("clears the plain and both secure-prefixed variants of every flow cookie", () => {
    const names = authFlowCookieNames();

    for (const base of [
      "authjs.csrf-token",
      "authjs.callback-url",
      "authjs.state",
      "authjs.pkce.code_verifier",
      "authjs.nonce",
    ]) {
      expect(names).toContain(base);
      expect(names).toContain(`__Secure-${base}`);
      expect(names).toContain(`__Host-${base}`);
    }
  });

  it("never touches the session-token so a valid session is preserved", () => {
    const names = authFlowCookieNames();
    expect(names.some((n) => n.includes("session-token"))).toBe(false);
  });

  it("returns no duplicate names", () => {
    const names = authFlowCookieNames();
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("isSecureOrigin", () => {
  it("is true for an https AUTH_URL (production)", () => {
    expect(isSecureOrigin("https://namecard.example.com")).toBe(true);
  });

  it("is false for an http AUTH_URL (local dev)", () => {
    expect(isSecureOrigin("http://localhost:3000")).toBe(false);
  });

  it("falls back to false for an unparseable value", () => {
    expect(isSecureOrigin("not-a-url")).toBe(false);
  });
});

describe("recovery marker", () => {
  it("uses a short, bounded lifetime to cap retries at one", () => {
    expect(RECOVER_MARKER_COOKIE).toBe("authjs.recover-attempted");
    expect(RECOVER_MARKER_MAX_AGE_SECONDS).toBeGreaterThan(0);
    expect(RECOVER_MARKER_MAX_AGE_SECONDS).toBeLessThanOrEqual(300);
  });
});
