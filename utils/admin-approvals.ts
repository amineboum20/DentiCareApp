import type { SupabaseClient } from "@supabase/supabase-js";

// Admin approval queue rules — a signup (practice owner) or an invited member
// only becomes approvable once they have CONFIRMED their email. That matches
// the "Nouvelle inscription" email to the admins, which is only sent from the
// auth callback, i.e. after confirmation. Unconfirmed accounts stay out of the
// approval queue and the sidebar badge.

/** Auth user ids whose email is confirmed. */
export async function confirmedUserIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  return new Set((data?.users ?? []).filter((u) => u.email_confirmed_at).map((u) => u.id));
}

export async function isEmailConfirmed(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.auth.admin.getUserById(userId);
  return Boolean(data?.user?.email_confirmed_at);
}

/** Number of items an admin can act on: confirmed pending practices + confirmed pending members. */
export async function pendingApprovalCount(supabase: SupabaseClient): Promise<number> {
  const [{ data: practices }, { data: members }, confirmed] = await Promise.all([
    supabase.from("practices").select("id").eq("is_approved", false),
    supabase.from("practice_members").select("practice_id, user_id, role, is_approved"),
    confirmedUserIds(supabase),
  ]);
  const pendingIds = new Set((practices ?? []).map((p) => p.id as string));
  const rows = (members ?? []) as { practice_id: string; user_id: string | null; role: string; is_approved: boolean }[];

  const countedPractices = new Set<string>();
  let memberCount = 0;
  for (const m of rows) {
    if (!m.user_id || !confirmed.has(m.user_id)) continue;
    if (m.role === "owner") {
      if (pendingIds.has(m.practice_id)) countedPractices.add(m.practice_id);
    } else if (m.is_approved === false) {
      memberCount++;
    }
  }
  return countedPractices.size + memberCount;
}
