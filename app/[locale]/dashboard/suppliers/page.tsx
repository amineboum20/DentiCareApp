import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import type { Supplier } from "@/types/database";
import SuppliersClient from "./SuppliersClient";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: member } = await supabase
    .from("practice_members")
    .select("practice_id")
    .eq("user_id", user.id)
    .single();

  if (!member) redirect("/onboarding");

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("practice_id", member.practice_id)
    .order("name");

  return <SuppliersClient initialSuppliers={(suppliers ?? []) as Supplier[]} />;
}
