// Documents page: every PDF the app can generate, listed from the records they
// are built from, and re-generated on demand (nothing is stored — a document is
// always rebuilt from the live data, exactly like the detail-page buttons).

import type { SupabaseClient } from "@supabase/supabase-js";
import { exportFacturePdf, exportOrdonnancePdf, type PdfFile } from "@/utils/pdf-export";
import { exportPatientInfoPdf } from "@/utils/patient-print";
import { isChildAge } from "@/components/odontogram-data";

export const DOC_KINDS = ["invoice", "quote", "ordonnance", "patientSheet"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_ICONS: Record<DocKind, string> = { invoice: "🧾", quote: "📝", ordonnance: "💊", patientSheet: "🪪" };

export interface DocRow {
  key: string;            // unique row key (kind + id)
  kind: DocKind;
  id: string;             // source record id
  reference: string;      // DC-…, DV-…, ORD-…, or "" for a patient sheet
  party: string;          // patient name
  date: string;           // YYYY-MM-DD
  createdBy: string | null;
  href: string;           // detail page of the source record
}

export interface ShopInfo { shopName: string; shopAddress: string; shopPhone: string; logoUrl: string | null }

type Person = { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const personName = (p: Person) => {
  const o = one(p);
  return o ? `${o.first_name} ${o.last_name}`.trim() : "";
};

export async function listDocuments(supabase: SupabaseClient): Promise<DocRow[]> {
  const [{ data: factures }, { data: ordonnances }, { data: patients }] = await Promise.all([
    supabase.from("factures")
      .select("id, type, created_at, created_by, patients(first_name, last_name)")
      .is("archived_at", null)
      .neq("status", "annulee"),
    supabase.from("ordonnances")
      .select("id, date, created_by, patients(first_name, last_name)")
      .is("archived_at", null)
      .neq("status", "annulee"),
    supabase.from("patients")
      .select("id, first_name, last_name, created_at, created_by")
      .is("archived_at", null),
  ]);

  const rows: DocRow[] = [];
  for (const f of factures ?? []) {
    const devis = f.type === "devis";
    rows.push({
      key: `facture:${f.id}`, kind: devis ? "quote" : "invoice", id: f.id as string,
      reference: `${devis ? "DV" : "DC"}-${String(f.id).slice(0, 8).toUpperCase()}`,
      party: personName(f.patients as Person), date: String(f.created_at).slice(0, 10),
      createdBy: (f.created_by as string | null) ?? null, href: `/dashboard/factures/${f.id}`,
    });
  }
  for (const o of ordonnances ?? []) {
    rows.push({
      key: `ordonnance:${o.id}`, kind: "ordonnance", id: o.id as string,
      reference: `ORD-${String(o.id).slice(0, 8).toUpperCase()}`,
      party: personName(o.patients as Person), date: String(o.date).slice(0, 10),
      createdBy: (o.created_by as string | null) ?? null, href: `/dashboard/ordonnances/${o.id}`,
    });
  }
  for (const p of patients ?? []) {
    rows.push({
      key: `patientSheet:${p.id}`, kind: "patientSheet", id: p.id as string, reference: "",
      party: `${p.first_name} ${p.last_name}`.trim(), date: String(p.created_at).slice(0, 10),
      createdBy: (p.created_by as string | null) ?? null, href: `/dashboard/patients/${p.id}`,
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/** Rebuild one document as a PDF file (same content as its detail-page button). */
export async function renderDocument(
  supabase: SupabaseClient,
  row: DocRow,
  shop: ShopInfo,
  t: (key: string) => string, // root translator (keys like "factureStatus.payee")
): Promise<PdfFile> {
  let file: PdfFile | undefined;

  if (row.kind === "invoice" || row.kind === "quote") {
    const [{ data: f, error }, { data: items }] = await Promise.all([
      supabase.from("factures").select("*, patients(first_name, last_name, phone, address, public_token)").eq("id", row.id).single(),
      supabase.from("facture_items").select("description, quantity, unit_price, teeth").eq("facture_id", row.id).order("id"),
    ]);
    if (error || !f) throw new Error(error?.message ?? "not found");
    const pat = one(f.patients as { first_name: string; last_name: string; phone: string | null; address: string | null; public_token: string } | null);
    // Same rule as the facture page: a dossier's deposit lives in the acomptes ledger.
    let depositPaid = Number(f.deposit_paid);
    if (f.dossier_id) {
      const { data: acs } = await supabase.from("acomptes").select("montant").eq("dossier_id", f.dossier_id);
      depositPaid = Math.min((acs ?? []).reduce((s, a) => s + Number(a.montant), 0), Number(f.total_price));
    }
    file = await exportFacturePdf({
      factureId: f.id,
      docType: f.type,
      appointmentId: f.appointment_id,
      patientName: pat ? `${pat.first_name} ${pat.last_name}` : "",
      patientPhone: pat?.phone ?? null,
      patientAddress: pat?.address ?? null,
      createdAt: f.created_at,
      statusLabel: t(`factureStatus.${f.status}`),
      items: (items ?? []).map((i) => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price, teeth: i.teeth })),
      totalPrice: f.total_price,
      depositPaid,
      notes: f.notes,
      ...shop,
      patientToken: pat?.public_token ?? null,
      output: "blob",
    });
  } else if (row.kind === "ordonnance") {
    const [{ data: o, error }, { data: lignes }] = await Promise.all([
      supabase.from("ordonnances").select("*, patients(first_name, last_name, phone, public_token)").eq("id", row.id).single(),
      supabase.from("ordonnance_lignes").select("name, posologie, duree, quantite, instructions").eq("ordonnance_id", row.id).order("sort_order"),
    ]);
    if (error || !o) throw new Error(error?.message ?? "not found");
    const pat = one(o.patients as { first_name: string; last_name: string; phone: string | null; public_token: string } | null);
    file = await exportOrdonnancePdf({
      ordonnanceId: o.id,
      patientName: pat ? `${pat.first_name} ${pat.last_name}` : "",
      patientPhone: pat?.phone ?? null,
      date: o.date,
      prescriber: o.prescriber,
      lines: (lignes ?? []).map((l) => ({ name: l.name, posologie: l.posologie, duree: l.duree, quantite: l.quantite, instructions: l.instructions })),
      notes: o.notes,
      ...shop,
      patientToken: pat?.public_token ?? null,
      output: "blob",
    });
  } else {
    const [{ data: p, error }, { data: teeth }, { data: planned }] = await Promise.all([
      supabase.from("patients").select("*").eq("id", row.id).single(),
      supabase.from("tooth_chart").select("tooth, status").eq("patient_id", row.id),
      supabase.from("tooth_plan").select("tooth").eq("patient_id", row.id).eq("status", "planned"),
    ]);
    if (error || !p) throw new Error(error?.message ?? "not found");
    file = await exportPatientInfoPdf({
      patientName: `${p.first_name} ${p.last_name}`.trim(),
      dob: p.date_of_birth,
      sexe: p.sexe,
      cin: p.cin,
      phone: p.phone,
      address: p.address,
      mutuelleOrganisme: p.mutuelle_organisme,
      mutuelleNumero: p.mutuelle_numero,
      mutuelleLien: p.mutuelle_lien,
      chart: Object.fromEntries(((teeth ?? []) as { tooth: string; status: string }[]).map((r) => [r.tooth, { status: r.status }])),
      isChild: isChildAge(p.date_of_birth),
      plannedTeeth: ((planned ?? []) as { tooth: string }[]).map((x) => x.tooth),
      ...shop,
      patientToken: p.public_token,
      output: "blob",
    });
  }

  if (!file) throw new Error("no file");
  return file;
}
