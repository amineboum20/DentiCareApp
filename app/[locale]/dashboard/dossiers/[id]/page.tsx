import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import DossierDetailClient from "./DetailClient";
import type { DossierWithPatient } from "@/types/database";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function DossierDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("*, patients(first_name, last_name, phone, address)")
    .eq("id", id)
    .single();

  if (!dossier) notFound();

  return (
    <div className="p-4 sm:p-8">
      <DossierDetailClient dossier={dossier as DossierWithPatient} locale={locale} />
    </div>
  );
}
