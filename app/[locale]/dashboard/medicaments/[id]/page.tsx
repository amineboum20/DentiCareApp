import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import MedicamentDetailClient from "./DetailClient";
import type { Medicament } from "@/types/database";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function MedicamentDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("medicaments").select("*").eq("id", id).single();
  if (!data) notFound();

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <MedicamentDetailClient medicament={data as Medicament} locale={locale} />
    </div>
  );
}
