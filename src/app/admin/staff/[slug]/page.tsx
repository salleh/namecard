import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { org } from "@/config/org";
import { getStaffCardForEdit } from "@/features/admin/adminRepository";
import { parseSlug } from "@/features/card/slug";
import { AdminEditForm } from "./AdminEditForm";

export const metadata: Metadata = { title: `Edit staff card — ${org.appName}` };

interface AdminEditPageProps {
  params: Promise<{ slug: string }>;
}

// Admin per-employee editor (HR request 3). The /admin layout already gates this
// to M365 admins (denials audited + 404'd). The slug is validated and the card
// looked up by it; an unknown or malformed slug 404s.
export default async function AdminEditPage({ params }: AdminEditPageProps) {
  const { slug: rawSlug } = await params;
  const slug = parseSlug(rawSlug);
  if (!slug) {
    notFound();
  }

  const card = await getStaffCardForEdit(slug);
  if (!card) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {card.displayName ?? card.emailSlug}
          </h1>
          <p className="text-sm text-neutral-500">
            <code className="rounded bg-neutral-100 px-1">/{card.emailSlug}</code>
            {card.disabled && <span className="ml-2 text-red-600">Disabled</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/${card.emailSlug}`} className="btn btn-secondary" target="_blank">
            View public card
          </Link>
          <Link href="/admin" className="btn btn-ghost">
            Back to staff cards
          </Link>
        </div>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Edit any field on this staff member&apos;s card, or pull their latest details from Microsoft
        365 for review. Changes affect only the namecard — nothing is written back to Microsoft 365.
      </p>

      <AdminEditForm slug={card.emailSlug} initial={card} hasPhoto={card.hasPhoto} />
    </main>
  );
}
