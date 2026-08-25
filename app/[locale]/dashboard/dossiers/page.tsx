import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import DossiersClient from "./DossiersClient";
import type { DossierWithPatient } from "@/types/database";

export default async function DossiersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: dossiers } = await supabase
    .from("dossiers")
    .select("*, patients(first_name, last_name)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <DossiersClient
          initialDossiers={(dossiers ?? []) as DossierWithPatient[]}
          userId={user!.id}
        />
      </Suspense>
    </div>
  );
}
