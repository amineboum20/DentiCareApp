import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const meta = user.user_metadata ?? {};

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-8">Paramètres</h1>
      <SettingsClient
        userId={user.id}
        initialShopName={meta.shop_name ?? ""}
        initialAddress={meta.shop_address ?? ""}
        initialPhone={meta.shop_phone ?? ""}
        initialLogoUrl={meta.logo_url ?? null}
      />
    </div>
  );
}
