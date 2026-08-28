import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import PatientDetailClient from "./DetailClient";
import type { Patient } from "@/types/database";

interface Props {
  params: { locale: string; id: string };
}

export default async function PatientDetailPage({ params }: Props) {
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!patient) notFound();

  return (
    <div className="p-4 sm:p-8">
      <PatientDetailClient patient={patient as Patient} locale={params.locale} />
    </div>
  );
}
