import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import ConsultationDetailClient from "./DetailClient";
import type { ConsultationWithPatient } from "@/types/database";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ConsultationDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: consultation } = await supabase
    .from("consultations")
    .select("*, patients(first_name, last_name)")
    .eq("id", id)
    .single();

  if (!consultation) notFound();

  return (
    <div className="p-4 sm:p-8">
      <ConsultationDetailClient consultation={consultation as ConsultationWithPatient} locale={locale} />
    </div>
  );
}
