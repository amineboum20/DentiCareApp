import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import type { Supplier, SupplierOrder } from "@/types/database";
import SupplierOrdersClient from "./SupplierOrdersClient";

export default async function SupplierOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: member } = await supabase
    .from("practice_members")
    .select("practice_id")
    .eq("user_id", user.id)
    .single();

  if (!member) redirect("/onboarding");

  const [{ data: orders }, { data: suppliers }] = await Promise.all([
    supabase.from("supplier_orders").select("*").eq("practice_id", member.practice_id).order("ordered_at", { ascending: false }),
    supabase.from("suppliers").select("*").eq("practice_id", member.practice_id).order("name"),
  ]);

  return (
    <SupplierOrdersClient
      initialOrders={(orders ?? []) as SupplierOrder[]}
      suppliers={(suppliers ?? []) as Supplier[]}
    />
  );
}
