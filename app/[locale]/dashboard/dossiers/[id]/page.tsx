import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import DossierDetailClient from "./DetailClient";
import type { DossierWithPatient } from "@/types/database";

interface Props {
  params: { locale: string; id: string };
}

export default async function DossierDetailPage({ params }: Props) {
  const supabase = await createClient();

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("*, patients(first_name, last_name)")
    .eq("id", params.id)
    .single();

  if (!dossier) notFound();

  return (
    <div className="p-4 sm:p-8">
      <DossierDetailClient dossier={dossier as DossierWithPatient} locale={params.locale} />
    </div>
  );
}
