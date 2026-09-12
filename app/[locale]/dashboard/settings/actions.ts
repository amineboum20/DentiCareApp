"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Link the CALLING member's account to a praticien (or clear it) so their agenda
 * can default to their own name. practice_members has no UPDATE RLS policy, so
 * this runs through the admin client — but strictly scoped to the session user's
 * own row, and it only ever writes praticien_id (never role), so it can't be used
 * to self-escalate. Assistants are not praticiens and are rejected.
 */
export async function setMyPraticien(praticienId: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autorisé");

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("practice_members")
    .select("id, practice_id, role")
    .eq("user_id", user.id)
    .single();
  if (!member) throw new Error("Membre introuvable");
  if (member.role === "assistant") throw new Error("Non autorisé");

  // A praticien must belong to the caller's own practice.
  if (praticienId) {
    const { data: prat } = await admin
      .from("praticiens")
      .select("id")
      .eq("id", praticienId)
      .eq("practice_id", member.practice_id)
      .single();
    if (!prat) throw new Error("Praticien invalide");
  }

  const { error } = await admin
    .from("practice_members")
    .update({ praticien_id: praticienId })
    .eq("id", member.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/agenda");
}
