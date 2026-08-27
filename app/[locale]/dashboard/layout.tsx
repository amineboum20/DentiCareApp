import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AppProvider } from "@/components/AppContext";
import Sidebar from "./Sidebar";
import GlobalSearch from "@/components/GlobalSearch";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/signin");

  const meta = user.user_metadata ?? {};
  const firstName   = meta.first_name   ?? "";
  const shopName    = meta.shop_name    ?? "DentiCare";
  const shopAddress = meta.shop_address ?? "";
  const shopPhone   = meta.shop_phone   ?? "";
  const logoUrl     = meta.logo_url     ?? null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppProvider shopName={shopName} shopAddress={shopAddress} shopPhone={shopPhone} logoUrl={logoUrl}>
        <Sidebar firstName={firstName} shopName={shopName} email={user.email ?? ""} />
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
