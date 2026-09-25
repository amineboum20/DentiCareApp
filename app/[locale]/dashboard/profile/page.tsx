import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ProfileClient from "./ProfileClient";
import MyPraticienCard from "./MyPraticienCard";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: member } = await supabase
    .from("practice_members")
    .select("first_name, last_name, role, praticien_id, practices(name)")
    .eq("user_id", user.id)
    .single();
  if (!member) redirect("/signin");
  const practice = Array.isArray(member.practices) ? member.practices[0] : member.practices;

  const { data: praticiens } = member.role === "assistant"
    ? { data: [] }
    : await supabase.from("praticiens").select("id, name").is("archived_at", null).order("name", { ascending: true });

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <ProfileClient
        initialFirstName={member.first_name ?? ""}
        initialLastName={member.last_name ?? ""}
        email={user.email ?? ""}
        pendingEmail={user.new_email ?? null}
        role={member.role}
        practiceName={(practice as { name: string } | null)?.name ?? ""}
      >
        {member.role !== "assistant" && (praticiens ?? []).length > 0 && (
          <MyPraticienCard
            praticiens={(praticiens ?? []) as { id: string; name: string }[]}
            initial={(member as { praticien_id?: string | null }).praticien_id ?? null}
          />
        )}
      </ProfileClient>
    </div>
  );
}
