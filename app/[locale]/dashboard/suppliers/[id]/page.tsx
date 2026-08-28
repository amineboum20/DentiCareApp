import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import SupplierDetailClient from "./DetailClient";
import type { Supplier } from "@/types/database";

interface Props {
  params: { locale: string; id: string };
}

export default async function SupplierDetailPage({ params }: Props) {
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!supplier) notFound();

  return (
    <div className="p-4 sm:p-8">
      <SupplierDetailClient supplier={supplier as Supplier} locale={params.locale} />
    </div>
  );
}
