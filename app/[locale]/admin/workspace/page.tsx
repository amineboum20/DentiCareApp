import { redirect } from "next/navigation";
import { getAdminUser } from "@/utils/admin-auth";
import AdminNav from "../AdminNav";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const admin = await getAdminUser();
  if (!admin) redirect("/signin");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">🦷</span>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Admin — DentiCare</h1>
        </div>
        <AdminNav active="workspace" />
        <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <iframe
            src={`/${locale}/admin/workspace/raw`}
            title="Espace technique"
            className="w-full h-[calc(100vh-180px)] min-h-[600px] border-0"
          />
        </div>
      </div>
    </div>
  );
}
