import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import FacturesClient from "./FacturesClient";
import type { FactureWithPatient } from "@/types/database";

export default async function FacturesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: factures } = await supabase
    .from("factures")
    .select("*, patients(first_name, last_name, phone)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <FacturesClient
          initialFactures={(factures ?? []) as FactureWithPatient[]}
          userId={user!.id}
        />
      </Suspense>
    </div>
  );
}
