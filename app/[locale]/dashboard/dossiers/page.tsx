import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import DossiersClient from "./DossiersClient";
import type { DossierWithPatient, Patient } from "@/types/database";

export default async function DossiersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("user_id", user!.id)
    .is("archived_at", null)
    .order("last_name");

  const { data: dossiers } = await supabase
    .from("dossiers")
    .select("*, patients(first_name, last_name)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <DossiersClient
          initialDossiers={(dossiers ?? []) as DossierWithPatient[]}
          userId={user!.id}
          patients={(patients ?? []) as Pick<Patient, "id" | "first_name" | "last_name">[]}
        />
      </Suspense>
    </div>
  );
}
