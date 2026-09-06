import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import TraitementDetailClient from "./DetailClient";
import type { Acte } from "@/types/database";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function TraitementDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const [{ data: traitement }, { data: actes }] = await Promise.all([
    supabase
      .from("traitements")
      .select("*, traitement_actes(id, acte_id, quantity, sort_order, actes(id, name, price))")
      .eq("id", id)
      .single(),
    supabase
      .from("actes")
      .select("id, name, price, category")
      .order("name", { ascending: true }),
  ]);

  if (!traitement) notFound();

  return (
    <div className="p-4 sm:p-8">
      <TraitementDetailClient
        traitement={traitement}
        actes={(actes ?? []) as Pick<Acte, "id" | "name" | "price" | "category">[]}
        locale={locale}
      />
    </div>
  );
}
