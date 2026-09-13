import { createClient } from "@/utils/supabase/server";
import { getMemberWithPractice } from "@/utils/supabase/queries";
import AgendaClient, { type AgendaAppointment } from "./AgendaClient";

export default async function AgendaPage() {
  const supabase = await createClient();

  const result = await getMemberWithPractice();
  const defaultPraticienId = (result?.member as { praticien_id?: string | null } | undefined)?.praticien_id ?? null;

  const [{ data: appointments }, { data: praticiens }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, title, scheduled_at, duration_minutes, type, status, praticien_id, patient_id, contact_first_name, contact_last_name, patients(first_name, last_name)")
      .is("archived_at", null)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("praticiens")
      .select("id, name")
      .is("archived_at", null)
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <AgendaClient
        initialAppointments={(appointments ?? []) as unknown as AgendaAppointment[]}
        praticiens={(praticiens ?? []) as { id: string; name: string }[]}
        defaultPraticienId={defaultPraticienId}
      />
    </div>
  );
}
