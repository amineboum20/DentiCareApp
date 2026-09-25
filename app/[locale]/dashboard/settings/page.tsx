import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";
import SubscriptionSection from "./SubscriptionSection";
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

  const { data: praticiens } = await supabase
    .from("praticiens")
    .select("id, name")
    .is("archived_at", null)
    .order("name", { ascending: true });

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-8">{t("pageTitle")}</h1>
      {member.role === "owner" && (
        <div className="mb-6">
          <SubscriptionSection practiceName={practice?.name ?? ""} practiceAddress={practice?.address ?? null} practicePhone={practice?.phone ?? null} />
        </div>
      )}
      <SettingsClient
        practiceId={member.practice_id}
        memberRole={member.role}
        initialShopName={practice?.name ?? ""}
        initialAddress={practice?.address ?? ""}
        initialPhone={practice?.phone ?? ""}
        initialLogoUrl={practice?.logo_url ?? null}
        praticiens={(praticiens ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
