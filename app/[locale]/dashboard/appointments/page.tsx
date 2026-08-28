import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import AppointmentsClient from "./AppointmentsClient";
import type { AppointmentWithPatient, Patient } from "@/types/database";

export default async function AppointmentsPage() {
  const supabase = await createClient();

  const [{ data: appointments }, { data: patients }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, patients(first_name, last_name)")
      .is("archived_at", null)
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .is("archived_at", null)
      .order("last_name", { ascending: true }),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <AppointmentsClient
          initialAppointments={(appointments ?? []) as AppointmentWithPatient[]}
          patients={(patients ?? []) as Pick<Patient, "id" | "first_name" | "last_name">[]}
        />
      </Suspense>
    </div>
  );
}
