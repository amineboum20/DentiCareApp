import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { pendingApprovalCount } from "@/utils/admin-approvals";
import AdminSidebar from "./AdminSidebar";
import { NO_INDEX } from "@/utils/seo";

// Private area: never indexed.
export const metadata: Metadata = { robots: NO_INDEX, alternates: { canonical: null } };

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/signin");

  const supabase = createAdminClient();
  // Badge = approvable items only (email confirmed), same as the Approbations list.
  const [pendingCount, { count: openTickets }] = await Promise.all([
    pendingApprovalCount(supabase),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar email={admin.email ?? ""} pendingCount={pendingCount} openTickets={openTickets ?? 0} />
      <div className="sm:ms-56 min-h-screen pt-14 sm:pt-0">{children}</div>
    </div>
  );
}
