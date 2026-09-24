import type { SupabaseClient } from "@supabase/supabase-js";

export type BillableActe = { id: string; name: string; price: number; quantity?: number; teeth?: string[] | null; category?: string | null; tooth_status?: string | null };

// A tooth-scoped acte reflects its result on the odontogram (tooth_chart).
// Only structural categories map to a tooth state; cleaning/whitening/ortho don't.
const CATEGORY_TO_TOOTH_STATUS: Record<string, string> = {
  obturation: "obturee",
  extraction: "absente",
  couronne: "couronne",
  implant: "implant",
  prothese: "prothese",
};

/** The tooth_chart status an acte leaves on a tooth, or undefined if it doesn't change it. */
export function toothStatusForActe(a: { tooth_status?: string | null; category?: string | null }): string | undefined {
  return a.tooth_status || (a.category ? CATEGORY_TO_TOOTH_STATUS[a.category] : undefined);
}

/**
 * Bill one or more actes into a dossier: append them as lines to the dossier's
 * open (non-annulée, non-payée) facture — creating a facture if there is none —
 * and bump its total. Shared by the visite forms and the RDV→visite conversion
 * so the billing behaviour stays identical everywhere.
 */
export async function billActesToDossier(
  supabase: SupabaseClient,
  opts: { practiceId: string; userId: string; patientId: string; dossierId: string; actes: BillableActe[]; acteDate?: string | null },
): Promise<void> {
  const { practiceId, userId, patientId, dossierId, actes, acteDate } = opts;
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

  const rows = lines.map((a) => {
    const teeth = a.teeth && a.teeth.length ? a.teeth : null;
    return {
      facture_id: target!.id, acte_id: a.id, description: a.name,
      quantity: teeth ? teeth.length : (a.quantity ?? 1),
      unit_price: a.price, acte_date: acteDate ?? null, teeth,
    };
  });
  await supabase.from("facture_items").insert(rows);
  const added = rows.reduce((s, r) => s + r.quantity * r.unit_price, 0);
  await supabase.from("factures").update({ total_price: Number(target.total_price) + added }).eq("id", target.id);

  // Reflect tooth-scoped structural actes on the patient's odontogram. The
  // source acte is stamped so the tooth history says which acte changed it.
  // One row per tooth (last acte wins) — an upsert can't touch a row twice.
  const now = new Date().toISOString();
  const byTooth = new Map<string, Record<string, unknown>>();
  for (const a of lines) {
    const status = toothStatusForActe(a);
    const teeth = a.teeth && a.teeth.length ? a.teeth : null;
    if (!status || !teeth) continue;
    for (const tooth of teeth) {
      byTooth.set(tooth, {
        practice_id: practiceId, patient_id: patientId, tooth, status, source_acte_id: a.id,
        user_id: userId, created_by: userId, updated_by: userId, updated_at: now,
      });
    }
  }
  if (byTooth.size > 0) {
    await supabase.from("tooth_chart").upsert([...byTooth.values()], { onConflict: "patient_id,tooth" });
  }

  // Billing a planned acte on a tooth completes that "soin prévu".
  await completePlannedCare(supabase, patientId, lines);
}

/** Mark the patient's planned care (tooth_plan) done for each billed acte × tooth. */
export async function completePlannedCare(
  supabase: SupabaseClient,
  patientId: string,
  actes: { id: string; teeth?: string[] | null }[],
): Promise<void> {
  const now = new Date().toISOString();
  for (const a of actes) {
    if (!a.teeth || a.teeth.length === 0) continue;
    await supabase.from("tooth_plan")
      .update({ status: "done", done_at: now })
      .eq("patient_id", patientId).eq("acte_id", a.id).eq("status", "planned")
      .in("tooth", a.teeth);
  }
}
