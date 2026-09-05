import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import ConsultationDetailClient from "./DetailClient";
import type { ConsultationWithPatient } from "@/types/database";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ConsultationDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: consultation } = await supabase
    .from("consultations")
    .select("*, patients(first_name, last_name), dossiers(id, title, statut)")
    .eq("id", id)
    .single();

  if (!consultation) notFound();

  const dossierId = (consultation as { dossier_id: string | null }).dossier_id;

  // The RDV this visite resulted from (if any), and a facturation snapshot of
  // the visite's dossier (Facturé / Payé / Reste).
  const [{ data: originRdv }, facturation] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, scheduled_at, title")
      .eq("consultation_id", id)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    (async () => {
      if (!dossierId) return null;
      const [{ data: facs }, { data: acs }] = await Promise.all([
        supabase.from("factures").select("total_price, status, type").eq("dossier_id", dossierId),
        supabase.from("acomptes").select("montant").eq("dossier_id", dossierId),
      ]);
      const facture = (facs ?? [])
        .filter((f) => f.type === "facture" && f.status !== "annulee")
        .reduce((s, f) => s + Number(f.total_price), 0);
      const paye = (acs ?? []).reduce((s, a) => s + Number(a.montant), 0);
      return { facture, paye, reste: facture - paye };
    })(),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <ConsultationDetailClient
        consultation={consultation as ConsultationWithPatient & { dossiers?: { id: string; title: string; statut: string } | { id: string; title: string; statut: string }[] | null }}
        originRdv={(originRdv as { id: string; scheduled_at: string; title: string } | null) ?? null}
        facturation={facturation}
        locale={locale}
      />
    </div>
  );
}
