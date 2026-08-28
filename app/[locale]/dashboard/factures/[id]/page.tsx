import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import FactureDetailClient from "./DetailClient";
import type { FactureWithPatient, Patient } from "@/types/database";

interface Props {
  params: { locale: string; id: string };
}

export default async function FactureDetailPage({ params }: Props) {
  const supabase = await createClient();

  const [{ data: facture }, { data: patients }] = await Promise.all([
    supabase
      .from("factures")
      .select("*, patients(first_name, last_name, phone)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .is("archived_at", null)
      .order("last_name"),
  ]);

  if (!facture) notFound();

  return (
    <div className="p-4 sm:p-8">
      <FactureDetailClient
        facture={facture as FactureWithPatient}
        patients={(patients ?? []) as Pick<Patient, "id" | "first_name" | "last_name">[]}
        locale={params.locale}
      />
    </div>
  );
}
