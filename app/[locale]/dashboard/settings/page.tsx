import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";
import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/signin");

  const { data: member } = await supabase
    .from("practice_members")
    .select("*, practices(*)")
    .eq("user_id", session.user.id)
    .single();

  if (!member) redirect("/signin");

  const practice = member.practices;

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-8">{t("pageTitle")}</h1>
      <SettingsClient
        practiceId={member.practice_id}
        memberRole={member.role}
        initialShopName={practice?.name ?? ""}
        initialAddress={practice?.address ?? ""}
        initialPhone={practice?.phone ?? ""}
        initialLogoUrl={practice?.logo_url ?? null}
      />
    </div>
  );
}
