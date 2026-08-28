import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import TraitementDetailClient from "./DetailClient";
import type { Traitement } from "@/types/database";

interface Props {
  params: { locale: string; id: string };
}

export default async function TraitementDetailPage({ params }: Props) {
  const supabase = await createClient();

  const { data: traitement } = await supabase
    .from("traitements")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!traitement) notFound();

  return (
    <div className="p-4 sm:p-8">
      <TraitementDetailClient traitement={traitement as Traitement} locale={params.locale} />
    </div>
  );
}
