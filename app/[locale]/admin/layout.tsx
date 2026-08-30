import { redirect } from "next/navigation";
import { getAdminUser } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import AdminSidebar from "./AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/signin");

  // Pending-approval count for the sidebar badge: pending practices + pending
  // owner-invited members.
  const supabase = createAdminClient();
  const [{ count: pendingPractices }, { count: pendingMembers }] = await Promise.all([
    supabase.from("practices").select("id", { count: "exact", head: true }).eq("is_approved", false),
    supabase.from("practice_members").select("id", { count: "exact", head: true }).eq("is_approved", false).neq("role", "owner"),
  ]);
  const pendingCount = (pendingPractices ?? 0) + (pendingMembers ?? 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar email={admin.email ?? ""} pendingCount={pendingCount} />
      <div className="sm:ms-56 min-h-screen">
        <div className="pt-14 sm:pt-0 min-h-screen">{children}</div>
      </div>
    </div>
  );
}
