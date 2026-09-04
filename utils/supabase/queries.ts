import { cache } from "react";
import { createClient } from "./server";
import type { PracticeMember, Practice } from "@/types/database";

// The joined row carries the approval flags that gate dashboard access; these
// live on the DB rows but are intentionally absent from the base interfaces.
type MemberWithPractice = PracticeMember & {
  is_approved?: boolean | null;
  practices: (Practice & { is_approved?: boolean | null }) | null;
};

// Cached per-request: layout and page both call this; only one DB round-trip fires.
export const getMemberWithPractice = cache(async () => {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;
  const { data } = await supabase
    .from("practice_members")
    .select("*, practices(*)")
    .eq("user_id", user.id)
    .single();
  return data ? { member: data as MemberWithPractice, user } : null;
});
