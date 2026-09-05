import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import PraticiensClient from "./PraticiensClient";
import type { Praticien } from "@/types/database";

export default async function PraticiensPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("praticiens")
    .select("*")
    .is("archived_at", null)
    .order("name");

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <PraticiensClient initial={(data ?? []) as Praticien[]} />
      </Suspense>
    </div>
  );
}
