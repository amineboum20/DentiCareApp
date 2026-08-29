import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import SupplierOrderDetailClient from "./DetailClient";
import type { SupplierOrder, Supplier } from "@/types/database";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function SupplierOrderDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("supplier_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (!order) notFound();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("practice_id", order.practice_id)
    .order("name");

  return (
    <div className="p-4 sm:p-8">
      <SupplierOrderDetailClient
        order={order as SupplierOrder}
        suppliers={(suppliers ?? []) as Supplier[]}
        locale={locale}
      />
    </div>
  );
}
