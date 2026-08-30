import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import TraitementsClient from "./TraitementsClient";
import type { Acte } from "@/types/database";

export default async function TraitementsPage() {
  const supabase = await createClient();

  const [{ data: traitements }, { data: actes }] = await Promise.all([
    supabase
      .from("traitements")
      .select("*, traitement_actes(id, acte_id, quantity, sort_order, actes(id, name, price))")
      .order("name", { ascending: true }),
    supabase
      .from("actes")
      .select("id, name, price, category")
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <TraitementsClient
          initialTraitements={traitements ?? []}
          actes={(actes ?? []) as Pick<Acte, "id" | "name" | "price" | "category">[]}
        />
      </Suspense>
    </div>
  );
}
