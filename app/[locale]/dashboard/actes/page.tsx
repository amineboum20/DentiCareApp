import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import ActesClient from "./ActesClient";
import type { Acte } from "@/types/database";

export default async function ActesPage() {
  const supabase = await createClient();

  const { data: actes } = await supabase
    .from("actes")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <ActesClient initialActes={(actes ?? []) as Acte[]} />
      </Suspense>
    </div>
  );
}
