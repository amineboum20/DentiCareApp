import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import FacturesClient from "./FacturesClient";
import type { FactureWithPatient, Patient } from "@/types/database";

export default async function FacturesPage() {
  const supabase = await createClient();

  const [{ data: patients }, { data: factures }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .is("archived_at", null)
      .order("last_name"),
    supabase
      .from("factures")
      .select("*, patients(first_name, last_name, phone)")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <FacturesClient
          initialFactures={(factures ?? []) as FactureWithPatient[]}
          patients={(patients ?? []) as Pick<Patient, "id" | "first_name" | "last_name">[]}
        />
      </Suspense>
    </div>
  );
}
