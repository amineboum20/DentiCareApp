import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import SupplierOrderDetailClient from "./DetailClient";
import type { SupplierOrder, Supplier } from "@/types/database";

interface Props {
  params: { locale: string; id: string };
}

export default async function SupplierOrderDetailPage({ params }: Props) {
  const supabase = await createClient();

  // Get the order and then the practice's suppliers
  const { data: order } = await supabase
    .from("supplier_orders")
    .select("*")
    .eq("id", params.id)
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
        locale={params.locale}
      />
    </div>
  );
}
