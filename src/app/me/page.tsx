import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { env, org } from "@/config";
import { BrandLogo } from "@/components/BrandLogo";
import { getOwnerCardByEntraObjectId } from "@/features/card/ownerRepository";
import { LOCKABLE_FIELDS } from "@/features/card/fieldPolicy";
import { getLockedFields } from "@/features/card/fieldPolicyRepository";
import { SignOutButton } from "@/components/SignOutButton";
import { EditForm } from "./EditForm";

export const metadata: Metadata = { title: `My card — ${org.appName}` };

// Authenticated route (own card only). Not statically renderable — it reads the
// session and the owner's DB row on every request.
export const dynamic = "force-dynamic";

export default async function MyCardPage() {
  const session = await auth();
  const entraObjectId = session?.user?.entraObjectId;

  // Unauthenticated → clean one-click sign-in screen. The single button starts
  // the Entra OIDC flow and returns here (`redirectTo: "/me"`) afterwards.
  if (!entraObjectId) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <BrandLogo size={64} />
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">
          Manage your namecard
        </h1>
        <p className="mt-3 text-neutral-600">
          Sign in with your {org.orgName} Microsoft 365 account to view and edit your namecard.
        </p>
        <form
          className="mt-6 w-full"
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/me" });
          }}
        >
          <button type="submit" className="btn btn-primary w-full">
            Sign in with Microsoft 365
          </button>
        </form>
      </main>
    );
  }

  const card = await getOwnerCardByEntraObjectId(entraObjectId);
  const locked = await getLockedFields();
  const lockedFields = LOCKABLE_FIELDS.filter((field) => locked.has(field));

  // Authenticated but no row yet (e.g. first-login Graph prefill failed). Don't
  // fabricate a card — tell the user to try signing in again.
  if (!card) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">My card</h1>
        <p className="mt-3 text-neutral-600">
          We couldn&apos;t find your card yet. Please sign out and sign in again to set it up.
        </p>
        <div className="mt-6">
          <SignOutButton className="btn btn-secondary" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">My card</h1>
        <div className="flex items-center gap-2">
          <Link href={`/${card.emailSlug}`} className="btn btn-secondary" target="_blank">
            View public card
          </Link>
          {session?.user?.isAdmin && (
            <Link href="/admin" className="btn btn-secondary">
              Admin
            </Link>
          )}
          <SignOutButton className="btn btn-ghost" />
        </div>
      </header>
      <p className="mt-2 text-sm text-neutral-600">
        Fill in or override any field. Changes affect only your namecard — nothing is written back
        to Microsoft 365.
      </p>
      {/* OwnerCard extends EditableTextFields, so it satisfies `initial` directly. */}
      <div className="mt-6">
        <EditForm
          initial={card}
          slug={card.emailSlug}
          hasPhoto={card.hasPhoto}
          origin={env.AUTH_URL}
          lockedFields={lockedFields}
        />
      </div>
    </main>
  );
}
