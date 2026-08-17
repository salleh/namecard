import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/features/admin/adminAccess";
import { logAdminAudit } from "@/features/admin/audit";

// Admin gate for every /admin/* route. Authorization is the M365 group claim
// only (isAdmin). Non-members are audited and served a 404 rather than a 403 —
// a 403 would confirm the admin surface exists, so we don't reveal it at all
// (enumeration-resistant, consistent with the public card 404 behavior).
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!isAdminSession(session)) {
    logAdminAudit({ type: "access_denied", email: session?.user?.email ?? null, path: "/admin" });
    notFound();
  }
  return children;
}
