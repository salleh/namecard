import { cookies } from "next/headers";
import { signIn } from "@/auth";
import { env } from "@/config/env";
import {
  RECOVER_MARKER_COOKIE,
  RECOVER_MARKER_MAX_AGE_SECONDS,
  authFlowCookieNames,
  isRecoverableAuthError,
  isSecureOrigin,
} from "@/features/auth/authRecovery";
import { AutoSubmit } from "./AutoSubmit";

type RecoverPageProps = {
  searchParams: Promise<{ error?: string }>;
};

// Where Auth.js sends OAuth failures (configured as `pages.error`). For a
// recoverable flow error we purge poisoned cookies and retry sign-in exactly
// once; a repeat failure lands on a plain error with a manual retry.
export default async function RecoverPage({ searchParams }: RecoverPageProps) {
  const { error } = await searchParams;
  const cookieStore = await cookies();
  const alreadyRetried = cookieStore.has(RECOVER_MARKER_COOKIE);
  const shouldAutoRetry = isRecoverableAuthError(error) && !alreadyRetried;

  // Server action: clear every variant of the OAuth flow cookies, mark that we
  // tried (short-lived, so a real failure only bounces once), then restart
  // sign-in. `signIn` sets fresh cookies and redirects to Entra.
  async function recoverAndRetry() {
    "use server";
    const store = await cookies();
    for (const name of authFlowCookieNames()) {
      store.delete(name);
    }
    store.set(RECOVER_MARKER_COOKIE, "1", {
      maxAge: RECOVER_MARKER_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecureOrigin(env.AUTH_URL),
    });
    await signIn("microsoft-entra-id", { redirectTo: "/me" });
  }

  if (shouldAutoRetry) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-neutral-600">Signing you in…</p>
        <AutoSubmit action={recoverAndRetry} />
      </main>
    );
  }

  // Also serves as the sign-in page (pages.signIn): shown for a normal sign-in
  // prompt (no error) and as the fallback after a retry has already been spent.
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">Sign in</h1>
      <p className="text-sm text-neutral-600">
        {error
          ? "We couldn’t complete your Microsoft sign-in. Please try again."
          : "Sign in to manage your e-namecard."}
      </p>
      <form action={recoverAndRetry}>
        <button type="submit" className="btn btn-primary">
          Sign in with Microsoft Entra ID
        </button>
      </form>
    </main>
  );
}
