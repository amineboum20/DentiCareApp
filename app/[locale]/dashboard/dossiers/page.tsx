import { createClient } from "@/utils/supabase/server";
import DossiersClient from "./DossiersClient";
import type { DossierWithPatient, Patient } from "@/types/database";

export default async function DossiersPage() {
  const supabase = await createClient();

  const { data: dossiers } = await supabase
    .from("dossiers")
    .select("*, patients(first_name, last_name)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .is("archived_at", null)
    .order("last_name", { ascending: true });

  return (
    <div className="p-4 sm:p-8">
      <DossiersClient
        initialDossiers={(dossiers ?? []) as DossierWithPatient[]}
        patients={(patients ?? []) as Pick<Patient, "id" | "first_name" | "last_name">[]}
      />
    </div>
  );
}
