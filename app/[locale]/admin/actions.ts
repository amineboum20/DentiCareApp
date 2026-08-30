"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function approvePractice(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Non autorisé");

  const practiceId = String(formData.get("practice_id") ?? "");
  if (!practiceId) throw new Error("practice_id manquant");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("practices")
    .update({ is_approved: true })
    .eq("id", practiceId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function revokePractice(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Non autorisé");

  const practiceId = String(formData.get("practice_id") ?? "");
  if (!practiceId) throw new Error("practice_id manquant");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("practices")
    .update({ is_approved: false })
    .eq("id", practiceId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}
