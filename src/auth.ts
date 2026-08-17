import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { env } from "@/config/env";
import { isSecureOrigin } from "@/features/auth/authRecovery";
import { fetchGraphPhoto, fetchGraphProfile } from "@/features/auth/graphClient";
import { buildSessionToken, type StaffCardTokenFields } from "@/features/auth/sessionToken";
import { EmailSlugCollisionError, upsertStaffCardFromGraph } from "@/features/auth/upsertStaffCard";

// Auth.js v5 (Entra OIDC, authorization-code flow). See CLAUDE.md
// "Authentication & Data Flow" and docs/deploy/entra-app-registration.md.

// Explicit clientId: this project renames the auto-inferred
// AUTH_MICROSOFT_ENTRA_ID_ID to AUTH_MICROSOFT_ENTRA_APPLICATION_ID
// (docs/deploy/entra-app-registration.md §9 "Auth.js naming note"), so Auth.js
// can no longer infer it from the env var name alone.
const entraProvider = MicrosoftEntraID({
  clientId: env.AUTH_MICROSOFT_ENTRA_APPLICATION_ID,
  clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  issuer: env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
  // `prompt: "select_account"` forces Entra to show the account chooser on every
  // sign-in instead of silently reusing the live SSO session — so after a
  // sign-out the next login is intentional (and a different account can be
  // picked). No password re-entry when the SSO session is still valid.
  authorization: {
    params: { scope: "openid profile email User.Read", prompt: "select_account" },
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // TLS terminates upstream at the DMZ nginx/Caddy (CLAUDE.md "Deployment
  // Topology") — Auth.js must trust the forwarded host/proto rather than the
  // raw request to build correct redirect URIs and Secure cookies.
  trustHost: true,
  // Pin the cookie prefix to the configured AUTH_URL rather than letting Auth.js
  // infer Secure-ness per request. Behind the proxy, per-request proto detection
  // could flip and emit BOTH plain `authjs.*` and `__Secure-`/`__Host-` cookies;
  // the stale duplicate then breaks the PKCE/CSRF check on the next login
  // (OAuthCallbackError / invalid_grant). Pinning keeps the names deterministic.
  // See src/features/auth/authRecovery.ts and src/app/auth/recover.
  useSecureCookies: isSecureOrigin(env.AUTH_URL),
  // Auth.js routes a failure to the page matching the error's `kind`, NOT a
  // fixed error page. OAuthCallbackError is a SignInError (kind: "signIn"), so it
  // resolves to `pages.signIn` — pointing only `pages.error` here does nothing.
  // We map both at /auth/recover, which purges poisoned flow cookies and retries
  // sign-in once so a user with stale cookies self-heals. `signIn(provider)`
  // calls go straight to Entra and never render this page, so doubling it as the
  // sign-in page is safe.
  pages: { signIn: "/auth/recover", error: "/auth/recover" },
  // JWT sessions: no Prisma adapter. We key our own StaffCard by
  // entraObjectId; Auth.js's own user/session/account tables would be
  // redundant state we'd have to keep in sync for no benefit.
  //
  // Token refresh/renewal (see CLAUDE.md "Authentication & Data Flow"):
  //   • Client ↔ Next.js: the session lives in a Secure, httpOnly, SameSite=Lax
  //     cookie signed with AUTH_SECRET (Secure/host cookie because AUTH_URL is
  //     https + trustHost). Auth.js re-issues (rotates) that cookie on activity
  //     every `updateAge`, extending it up to `maxAge` — so an active user is
  //     transparently kept signed in and never hits a hard mid-session expiry.
  //   • With M365 / Microsoft Graph: Graph is called exactly once, at first
  //     login, to snapshot the profile (the `account.access_token` is available
  //     only on that request). Thereafter PostgreSQL is the single source of
  //     truth and we never call Graph again, so there is deliberately no
  //     long-lived M365 access/refresh token to persist or renew — we don't
  //     request `offline_access`. Not holding a refresh token is the
  //     lower-exposure choice and is consistent with the "no write-back / no
  //     re-sync" non-goal. If periodic Entra reconciliation is added later, it
  //     should use app-only (client-credentials) Graph access, not a per-user
  //     refresh token carried in the session.
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days absolute lifetime
    updateAge: 24 * 60 * 60, // rotate the cookie at most once/day on activity
  },
  providers: [entraProvider],
  callbacks: {
    async jwt({ token, account, profile }) {
      // `account`/`account.access_token` are only present on the sign-in
      // request itself (Auth.js omits them on subsequent JWT refreshes
      // within the same session) — this is the "first sign-in" hook the
      // Step 5 spec calls for, firing once per actual login. All the I/O
      // (Graph calls + DB upsert) happens here; the actual token contents
      // are then decided by the pure `buildSessionToken` (see its own
      // module for why recomputation must be gated on `profile`, not just
      // attempted unconditionally — H-1 review fix).
      let staffCard: StaffCardTokenFields | undefined;

      if (account?.access_token) {
        try {
          const graphProfile = await fetchGraphProfile(account.access_token);
          const photo = await fetchGraphPhoto(account.access_token);
          const card = await upsertStaffCardFromGraph(graphProfile, photo);
          staffCard = { entraObjectId: card.entraObjectId, emailSlug: card.emailSlug };
        } catch (error) {
          if (error instanceof EmailSlugCollisionError) {
            // Distinct, alertable: a public slug is stuck pointing at a
            // stale/former card until an admin resolves the collision
            // (disable the old row, reissue, etc.) — this needs a human,
            // not just a retry on next login. Never logs token/secret
            // material (the error message only contains the emailSlug and
            // the two Entra object ids).
            console.error("auth: ALERT emailSlug collision on first-login upsert", error.message);
          } else {
            // Never fail the login over a Graph/DB hiccup — the user still
            // gets a session, just without the StaffCard claims until their
            // next successful login. Server-side only; never surfaced to
            // the client, never logs token/secret material.
            console.error("auth: first-login Graph prefill failed", error);
          }
        }
      }

      return buildSessionToken({ token, profile, adminGroupId: env.ADMIN_GROUP_ID, staffCard });
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          entraObjectId: token.entraObjectId,
          emailSlug: token.emailSlug,
          isAdmin: token.isAdmin ?? false,
        },
      };
    },
  },
});
