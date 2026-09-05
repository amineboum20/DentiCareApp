import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import OrdonnancesClient from "./OrdonnancesClient";
import type { OrdonnanceWithPatient, Patient } from "@/types/database";

export default async function OrdonnancesPage() {
  const supabase = await createClient();

  const [{ data: patients }, { data: ordonnances }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .is("archived_at", null)
      .order("last_name"),
    supabase
      .from("ordonnances")
      .select("*, patients(first_name, last_name, phone)")
      .is("archived_at", null)
      .order("date", { ascending: false }),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <OrdonnancesClient
          initialOrdonnances={(ordonnances ?? []) as OrdonnanceWithPatient[]}
          patients={(patients ?? []) as Pick<Patient, "id" | "first_name" | "last_name">[]}
        />
      </Suspense>
    </div>
  );
}
