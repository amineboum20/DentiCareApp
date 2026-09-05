import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import OrdonnanceDetailClient from "./DetailClient";
import type { OrdonnanceWithPatient, OrdonnanceLigne } from "@/types/database";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function OrdonnanceDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const [{ data: ordonnance }, { data: lignes }] = await Promise.all([
    supabase
      .from("ordonnances")
      .select("*, patients(first_name, last_name, phone), dossiers(id, title), consultations(id, exam_date, motif)")
      .eq("id", id)
      .single(),
    supabase.from("ordonnance_lignes").select("*").eq("ordonnance_id", id).order("sort_order"),
  ]);

  if (!ordonnance) notFound();

  return (
    <div className="p-4 sm:p-8">
      <OrdonnanceDetailClient
        ordonnance={ordonnance as OrdonnanceWithPatient & {
          dossiers?: { id: string; title: string } | { id: string; title: string }[] | null;
          consultations?: { id: string; exam_date: string; motif: string } | { id: string; exam_date: string; motif: string }[] | null;
        }}
        lignes={(lignes ?? []) as OrdonnanceLigne[]}
        locale={locale}
      />
    </div>
  );
}
