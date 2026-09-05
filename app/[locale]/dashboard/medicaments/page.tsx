import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import MedicamentsClient from "./MedicamentsClient";
import type { Medicament } from "@/types/database";

export default async function MedicamentsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("medicaments")
    .select("*")
    .is("archived_at", null)
    .order("name");

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <MedicamentsClient initial={(data ?? []) as Medicament[]} />
      </Suspense>
    </div>
  );
}
