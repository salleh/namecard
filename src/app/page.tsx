import Link from "next/link";
import { auth, signIn } from "@/auth";
import { org } from "@/config/org";
import { BrandLogo } from "@/components/BrandLogo";
import { SignOutButton } from "@/components/SignOutButton";
import { LookupForm } from "./LookupForm";

// Public landing page. Reads the session only to tailor the auth strip; the
// lookup form and hero are the same for everyone.
export default async function HomePage() {
  const session = await auth();
  const user = session?.user;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <section className="flex flex-col items-center text-center">
        <BrandLogo size={72} />
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          {org.appName}
        </h1>
        <p className="mt-3 max-w-md text-balance text-neutral-600">
          A staff member&apos;s digital namecard as a scannable QR code. Scan it with any phone
          camera to add them straight to your contacts.
        </p>
      </section>

      <section className="card mt-10 p-5 sm:p-6">
        <LookupForm />
        <p className="mt-3 text-sm text-neutral-500">
          Enter a colleague&apos;s email name (the part before{" "}
          <span className="whitespace-nowrap">@{org.emailDomain}</span>) to open their card.
        </p>
      </section>

      <section className="mt-8 text-center">
        {user ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-neutral-600">
              Signed in as{" "}
              <span className="font-medium text-neutral-800">
                {user.email ?? user.name ?? "staff member"}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Link href="/me" className="btn btn-primary">
                Manage my card
              </Link>
              <SignOutButton className="btn btn-secondary" />
            </div>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: "/me" });
            }}
          >
            <p className="text-sm text-neutral-600">
              {org.orgName} staff?{" "}
              <button type="submit" className="font-semibold text-brand-700 hover:underline">
                Sign in to manage your card
              </button>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
