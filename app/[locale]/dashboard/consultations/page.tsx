import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import ConsultationsClient from "./ConsultationsClient";
import type { ConsultationWithPatient, Patient } from "@/types/database";

export default async function ConsultationsPage() {
  const supabase = await createClient();

  const [{ data: patients }, { data: consultations }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .is("archived_at", null)
      .order("last_name"),
    supabase
      .from("consultations")
      .select("*, patients(first_name, last_name)")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <ConsultationsClient
          initialConsultations={(consultations ?? []) as ConsultationWithPatient[]}
          patients={(patients ?? []) as Pick<Patient, "id" | "first_name" | "last_name">[]}
        />
      </Suspense>
    </div>
  );
}
