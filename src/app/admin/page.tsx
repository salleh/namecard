import type { Metadata } from "next";
import Link from "next/link";
import { org } from "@/config/org";
import { SubmitButton } from "@/components/SubmitButton";
import { listStaffCards, type AdminStaffRow } from "@/features/admin/adminRepository";
import { normalizeAdminSearch } from "@/features/admin/adminSearch";
import { setCardDisabledAction } from "./actions";

export const metadata: Metadata = { title: `Staff admin — ${org.appName}` };

interface AdminPageProps {
  searchParams: Promise<{ q?: string }>;
}

function StatusBadge({ disabled }: { disabled: boolean }) {
  const cls = disabled ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {disabled ? "Disabled" : "Active"}
    </span>
  );
}

function StaffRow({ row }: { row: AdminStaffRow }) {
  const nextDisabled = !row.disabled;
  return (
    <tr className="border-b border-neutral-100">
      <td className="px-3 py-2.5 align-top">
        <a
          className="font-medium text-brand-700 hover:underline"
          href={`/${row.emailSlug}`}
          rel="noreferrer noopener"
          target="_blank"
        >
          {row.displayName ?? row.emailSlug}
        </a>
        <div className="text-xs text-neutral-500">{row.email ?? row.emailSlug}</div>
      </td>
      <td className="px-3 py-2.5 align-top text-neutral-700">{row.department ?? "—"}</td>
      <td className="px-3 py-2.5 align-top">
        <StatusBadge disabled={row.disabled} />
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex items-center gap-2">
          <Link href={`/admin/staff/${row.emailSlug}`} className="btn btn-secondary">
            Edit
          </Link>
          <form action={setCardDisabledAction}>
            <input type="hidden" name="slug" value={row.emailSlug} />
            <input type="hidden" name="disabled" value={String(nextDisabled)} />
            <SubmitButton
              pendingLabel="Working…"
              className={
                nextDisabled
                  ? "btn bg-red-600 text-white hover:bg-red-700"
                  : "btn bg-green-600 text-white hover:bg-green-700"
              }
            >
              {nextDisabled ? "Disable" : "Enable"}
            </SubmitButton>
          </form>
        </div>
      </td>
    </tr>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { q } = await searchParams;
  const search = normalizeAdminSearch(q);
  const rows = await listStaffCards(search);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Staff cards</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/fields" className="btn btn-secondary">
            Field settings
          </Link>
          <Link href="/me" className="btn btn-ghost">
            Back to my card
          </Link>
        </div>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Disable a card to make its public page stop resolving (e.g. when a staff member leaves).
      </p>

      <form method="get" className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search name, email, department…"
          aria-label="Search staff"
          className="input flex-1"
        />
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-neutral-500">No matching staff cards.</p>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2.5 font-semibold">Staff</th>
                <th className="px-3 py-2.5 font-semibold">Department</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <StaffRow key={row.emailSlug} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
