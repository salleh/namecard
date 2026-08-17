import Link from "next/link";
import { org } from "@/config/org";
import { BrandLogo } from "./BrandLogo";

// Site chrome shared by every route via the root layout. Deliberately
// session-free: reading auth here would force the public card pages (the
// hottest, enumeration-resistant routes) to render dynamically. The "My card"
// link points at /me, which owns the sign-in flow — so sign-in stays
// discoverable without a session read in the layout.

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <BrandLogo size={36} />
          <span className="text-base font-semibold tracking-tight text-neutral-900">
            {org.appShortName}
          </span>
        </Link>
        <Link href="/me" className="btn btn-ghost">
          My card
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-neutral-500">
        {org.appName} — for {org.orgName} staff and their contacts.
      </div>
    </footer>
  );
}
