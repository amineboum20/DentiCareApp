import type { SupabaseClient } from "@supabase/supabase-js";

export type BillableActe = { id: string; name: string; price: number; quantity?: number };

/**
 * Bill one or more actes into a dossier: append them as lines to the dossier's
 * open (non-annulée, non-payée) facture — creating a facture if there is none —
 * and bump its total. Shared by the visite forms and the RDV→visite conversion
 * so the billing behaviour stays identical everywhere.
 */
export async function billActesToDossier(
  supabase: SupabaseClient,
  opts: { practiceId: string; userId: string; patientId: string; dossierId: string; actes: BillableActe[] },
): Promise<void> {
  const { practiceId, userId, patientId, dossierId, actes } = opts;
  const lines = actes.filter((a) => a && a.id);
  if (lines.length === 0) return;

  const { data: facs } = await supabase
    .from("factures")
    .select("id, total_price, status, type")
    .eq("dossier_id", dossierId);
  let target = (facs ?? []).find(
    (f: { type: string; status: string }) => f.type === "facture" && f.status !== "annulee" && f.status !== "payee",
  ) as { id: string; total_price: number } | undefined;

  if (!target) {
    const { data: fac } = await supabase
      .from("factures")
      .insert({
        practice_id: practiceId, created_by: userId, user_id: userId,
        patient_id: patientId, dossier_id: dossierId,
        type: "facture", status: "en_attente", total_price: 0, deposit_paid: 0,
      })
      .select("id, total_price")
      .single();
    target = fac as { id: string; total_price: number } | undefined;
  }
  if (!target) return;

  const rows = lines.map((a) => ({
    facture_id: target!.id, acte_id: a.id, description: a.name,
    quantity: a.quantity ?? 1, unit_price: a.price,
  }));
  await supabase.from("facture_items").insert(rows);
  const added = rows.reduce((s, r) => s + r.quantity * r.unit_price, 0);
  await supabase.from("factures").update({ total_price: Number(target.total_price) + added }).eq("id", target.id);
}
