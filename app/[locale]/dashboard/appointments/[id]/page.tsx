import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import AppointmentDetailClient from "./DetailClient";
import type { AppointmentWithPatient, Patient } from "@/types/database";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AppointmentDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const [{ data: appointment }, { data: patients }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, patients(first_name, last_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .is("archived_at", null)
      .order("last_name"),
  ]);

  if (!appointment) notFound();

  return (
    <div className="p-4 sm:p-8">
      <AppointmentDetailClient
        appointment={appointment as AppointmentWithPatient}
        patients={(patients ?? []) as Pick<Patient, "id" | "first_name" | "last_name">[]}
        locale={locale}
      />
    </div>
  );
}
