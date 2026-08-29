import { cache } from "react";
import { createClient } from "./server";

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
  return data ? { member: data as any, user } : null;
});
