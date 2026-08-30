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

export async function rejectPractice(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Non autorisé");

  const practiceId = String(formData.get("practice_id") ?? "");
  if (!practiceId) throw new Error("practice_id manquant");

  const supabase = createAdminClient();

  // Collect the practice's member accounts before deleting the rows.
  const { data: members } = await supabase
    .from("practice_members")
    .select("user_id")
    .eq("practice_id", practiceId);
  const userIds = (members ?? []).map((m) => m.user_id as string);

  // Delete members, then the practice (members FK both auth.users and practices).
  await supabase.from("practice_members").delete().eq("practice_id", practiceId);
  const { error: practiceError } = await supabase.from("practices").delete().eq("id", practiceId);
  if (practiceError) throw new Error(practiceError.message);

  // Delete the auth accounts so the email is free to sign up again.
  for (const uid of userIds) {
    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) console.error("deleteUser error", uid, error.message);
  }

  revalidatePath("/admin");
}

export async function approveMember(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Non autorisé");

  const memberId = String(formData.get("member_id") ?? "");
  if (!memberId) throw new Error("member_id manquant");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("practice_members")
    .update({ is_approved: true })
    .eq("id", memberId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function rejectMember(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Non autorisé");

  const memberId = String(formData.get("member_id") ?? "");
  if (!memberId) throw new Error("member_id manquant");

  const supabase = createAdminClient();

  // Guard: never delete an owner through the member-reject path.
  const { data: target } = await supabase
    .from("practice_members")
    .select("user_id, role")
    .eq("id", memberId)
    .single();
  if (target?.role === "owner") throw new Error("Impossible de supprimer un propriétaire");

  await supabase.from("practice_members").delete().eq("id", memberId);
  if (target?.user_id) {
    const { error } = await supabase.auth.admin.deleteUser(target.user_id as string);
    if (error) console.error("deleteUser error", target.user_id, error.message);
  }

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
