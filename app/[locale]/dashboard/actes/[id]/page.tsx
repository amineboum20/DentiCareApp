import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import ActeDetailClient from "./DetailClient";
import type { Acte } from "@/types/database";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ActeDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: acte } = await supabase
    .from("actes")
    .select("*")
    .eq("id", id)
    .single();

  if (!acte) notFound();

  return (
    <div className="p-4 sm:p-8">
      <ActeDetailClient acte={acte as Acte} locale={locale} />
    </div>
  );
}
