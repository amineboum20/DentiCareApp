import { redirect } from "next/navigation";
import { getMemberWithPractice } from "@/utils/supabase/queries";
import { getAdminUser } from "@/utils/admin-auth";
import { AppProvider } from "@/components/AppContext";
import Sidebar from "./Sidebar";
import GlobalSearch from "@/components/GlobalSearch";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Admins have no practice; send them to the approval dashboard instead of the pending screen.
  if (await getAdminUser()) redirect("/admin");

  const result = await getMemberWithPractice();
  if (!result) redirect("/signin");

  const { member, user } = result;
  const practice = member.practices as any;

  if (!practice?.is_approved) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8 text-center">
          <span className="text-5xl">⏳</span>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">Compte en attente d&apos;approbation</h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Votre cabinet <strong>{practice?.name}</strong> est en cours de vérification. Vous recevrez un accès dès qu&apos;il sera approuvé.
          </p>
          <p className="mt-6 text-xs text-zinc-400">Des questions ? Contactez <a href="mailto:amine@opticareapp.com" className="text-teal-600 hover:underline">amine@opticareapp.com</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppProvider
        practiceId={member.practice_id}
        currentUserId={user.id}
        memberRole={member.role}
        memberName={member.first_name}
        shopName={practice?.name ?? "DentiCare"}
        shopAddress={practice?.address ?? ""}
        shopPhone={practice?.phone ?? ""}
        logoUrl={practice?.logo_url ?? null}
      >
        <Sidebar firstName={member.first_name} shopName={practice?.name ?? "DentiCare"} email={user.email ?? ""} />
        <div className="sm:ms-56 min-h-screen">
          <div className="hidden sm:flex sticky top-0 z-10 h-14 items-center justify-center px-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur border-b border-zinc-100 dark:border-zinc-800">
            <GlobalSearch />
          </div>
          <div className="pt-14 sm:pt-0">{children}</div>
        </div>
      </AppProvider>
    </div>
  );
}
