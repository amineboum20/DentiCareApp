import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/signin");

  const { data: member } = await supabase
    .from("practice_members")
    .select("*, practices(*)")
    .eq("user_id", session.user.id)
    .single();

  if (!member) redirect("/signin");

  const practice = (member as any).practices as any;

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-8">Paramètres</h1>
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
