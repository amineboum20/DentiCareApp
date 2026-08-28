import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import TraitementsClient from "./TraitementsClient";
import type { Traitement } from "@/types/database";

export default async function TraitementsPage() {
  const supabase = await createClient();

  const { data: traitements } = await supabase
    .from("traitements")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <TraitementsClient
          initialTraitements={(traitements ?? []) as Traitement[]}
        />
      </Suspense>
    </div>
  );
}
