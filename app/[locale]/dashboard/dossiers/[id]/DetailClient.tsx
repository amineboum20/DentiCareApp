"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type {
  DossierWithPatient, DossierStatut, ConsultationMotif,
  FactureDocType, FactureStatus, AcompteMoyen, AppointmentType,
} from "@/types/database";
import { useAppContext } from "@/components/AppContext";
import { DR } from "@/components/DetailRow";
import { exportFacturePdf, exportFeuilleSoinsPdf } from "@/utils/pdf-export";
import { billActesToDossier } from "@/utils/billing";
import { PraticienSelect } from "@/components/PraticienSelect";

interface Props {
  dossier: DossierWithPatient;
  locale: string;
}

type Visite = {
  id: string; motif: string; exam_date: string;
  teeth: string | null; treated_by: string | null; clinical_notes: string | null;
};
type Doc = {
  id: string; type: FactureDocType; status: FactureStatus;
  total_price: number; created_at: string; notes: string | null;
};
type Acompte = {
  id: string; montant: number; date_paiement: string; moyen: AcompteMoyen; note: string | null;
};
type Rdv = {
  id: string; title: string; scheduled_at: string; duration_minutes: number | null; type: string; status: string; notes: string | null;
};
type LineItem = { description: string; quantity: string; unit_price: string; acte_id?: string | null };
type ActeLite = { id: string; name: string; price: number };
type PackageLite = { id: string; name: string; price_override: number | null; lines: { quantity: number; name: string; price: number; acte_id: string }[] };

const STATUT_STYLE: Record<string, string> = {
  ouvert:  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  termine: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};
const STATUT_LABEL: Record<string, string> = { ouvert: "Ouvert", termine: "Terminé" };
const MOTIF_LABEL: Record<string, string> = {
  consultation: "Consultation", controle: "Contrôle", soin: "Soin", urgence: "Urgence", autre: "Autre",
};
const MOTIFS: ConsultationMotif[] = ["consultation", "controle", "soin", "urgence", "autre"];
const FACTURE_STATUS_LABEL: Record<string, string> = {
  en_attente: "En attente", en_cours: "En cours", payee: "Payée", annulee: "Annulée",
};
const FACTURE_STATUSES: FactureStatus[] = ["en_attente", "en_cours", "payee", "annulee"];
const MOYENS: AcompteMoyen[] = ["especes", "carte", "virement", "cheque", "autre"];
const MOYEN_LABEL: Record<string, string> = {
  especes: "Espèces", carte: "Carte", virement: "Virement", cheque: "Chèque", autre: "Autre",
};
const APPT_TYPES: AppointmentType[] = ["consultation", "nettoyage", "soin", "chirurgie", "controle", "orthodontie", "autre"];
const APPT_TYPE_LABEL: Record<string, string> = {
  consultation: "Consultation", nettoyage: "Nettoyage", soin: "Soin", chirurgie: "Chirurgie", controle: "Contrôle", orthodontie: "Orthodontie", autre: "Autre",
};
const APPT_STATUS_LABEL: Record<string, string> = {
  planifie: "Planifié", termine: "Terminé", annule: "Annulé", absent: "Absent",
};
const APPT_STATUS_STYLE: Record<string, string> = {
  planifie: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  termine:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  annule:   "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  absent:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function money(n: number) { return `${n.toFixed(2)} MAD`; }

export default function DossierDetailClient({ dossier: initialDossier, locale }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { practiceId, currentUserId, shopName, shopAddress, shopPhone, logoUrl } = useAppContext();

  const [dossier, setDossier] = useState<DossierWithPatient>(initialDossier);
  const [visites, setVisites] = useState<Visite[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [acomptes, setAcomptes] = useState<Acompte[]>([]);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [ordos, setOrdos] = useState<{ id: string; date: string; prescriber: string | null }[]>([]);
  const [actes, setActes] = useState<ActeLite[]>([]);
  const [packages, setPackages] = useState<PackageLite[]>([]);
  const [loading, setLoading] = useState(true);

  // modals
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [acompteOpen, setAcompteOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [visiteOpen, setVisiteOpen] = useState(false);
  const [rdvOpen, setRdvOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const [feuilleBusy, setFeuilleBusy] = useState(false);
  const [err, setErr] = useState("");

  const patient = dossier.patients as { first_name: string; last_name: string; phone?: string | null; address?: string | null };
  const patientName = `${patient.first_name} ${patient.last_name}`;

  useEffect(() => {
    Promise.all([
      supabase.from("consultations").select("id, motif, exam_date, teeth, treated_by, clinical_notes").eq("dossier_id", dossier.id).order("exam_date", { ascending: false }),
      supabase.from("factures").select("id, type, status, total_price, created_at, notes").eq("dossier_id", dossier.id).order("created_at", { ascending: false }),
      supabase.from("acomptes").select("id, montant, date_paiement, moyen, note").eq("dossier_id", dossier.id).order("date_paiement", { ascending: false }),
      supabase.from("actes").select("id, name, price").order("name", { ascending: true }),
      supabase.from("traitements").select("id, name, price_override, traitement_actes(quantity, acte_id, actes(name, price))").order("name", { ascending: true }),
      supabase.from("appointments").select("id, title, scheduled_at, duration_minutes, type, status, notes").eq("dossier_id", dossier.id).order("scheduled_at", { ascending: false }),
      supabase.from("ordonnances").select("id, date, prescriber").eq("dossier_id", dossier.id).is("archived_at", null).order("date", { ascending: false }),
    ]).then(([v, d, a, ac, tr, r, o]) => {
      setVisites((v.data ?? []) as Visite[]);
      setDocs((d.data ?? []) as Doc[]);
      setAcomptes((a.data ?? []) as Acompte[]);
      setRdvs((r.data ?? []) as Rdv[]);
      setOrdos((o.data ?? []) as { id: string; date: string; prescriber: string | null }[]);
      setActes((ac.data ?? []) as ActeLite[]);
      type TraitementRow = {
        id: string; name: string; price_override: number | null;
        traitement_actes: { quantity: number; acte_id: string; actes: { name: string; price: number } | null }[] | null;
      };
      setPackages(((tr.data ?? []) as unknown as TraitementRow[]).map((p) => ({
        id: p.id, name: p.name, price_override: p.price_override,
        lines: (p.traitement_actes ?? []).map((l) => ({
          quantity: l.quantity, acte_id: l.acte_id,
          name: l.actes?.name ?? "Acte", price: l.actes?.price ?? 0,
        })),
      })));
      setLoading(false);
    });
  }, [dossier.id, supabase]);

  const totalFacture = useMemo(() => docs.filter(d => d.type === "facture" && d.status !== "annulee").reduce((s, d) => s + Number(d.total_price), 0), [docs]);
  const totalDevis = useMemo(() => docs.filter(d => d.type === "devis").reduce((s, d) => s + Number(d.total_price), 0), [docs]);
  const totalPaid = useMemo(() => acomptes.reduce((s, a) => s + Number(a.montant), 0), [acomptes]);
  const reste = totalFacture - totalPaid;

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";
  // A visite is today or a forgotten past one — never the future (that's a RDV).
  const today = new Date().toLocaleDateString("en-CA");

  // ─── edit dossier ───
  const [editForm, setEditForm] = useState({ title: "", statut: "ouvert" as DossierStatut, notes: "" });
  function openEdit() {
    setEditForm({ title: dossier.title, statut: dossier.statut, notes: dossier.notes ?? "" });
    setErr(""); setEditOpen(true);
  }
  async function saveEdit() {
    if (!editForm.title.trim()) { setErr("L'intitulé est requis."); return; }
    setBusy(true); setErr("");
    const { data, error } = await supabase.from("dossiers")
      .update({ title: editForm.title.trim(), statut: editForm.statut, notes: editForm.notes.trim() || null })
      .eq("id", dossier.id).select("*, patients(first_name, last_name, phone, address)").single();
    if (error) { setErr(error.message); setBusy(false); return; }
    setDossier(data as DossierWithPatient);
    setBusy(false); setEditOpen(false);
  }
  async function deleteDossier() {
    setBusy(true);
    await supabase.from("dossiers").delete().eq("id", dossier.id);
    router.push(`/${locale}/dashboard/dossiers`);
  }

  // ─── add acompte ───
  const emptyAcompte = { montant: "", date_paiement: new Date().toISOString().slice(0, 10), moyen: "especes" as AcompteMoyen, note: "" };
  const [acompteForm, setAcompteForm] = useState(emptyAcompte);
  function openAcompte() { setAcompteForm(emptyAcompte); setErr(""); setAcompteOpen(true); }
  async function saveAcompte() {
    const montant = parseFloat(acompteForm.montant);
    if (!montant || montant <= 0) { setErr("Le montant doit être supérieur à 0."); return; }
    setBusy(true); setErr("");
    const { data, error } = await supabase.from("acomptes").insert({
      practice_id: practiceId, dossier_id: dossier.id, created_by: currentUserId,
      montant, date_paiement: acompteForm.date_paiement, moyen: acompteForm.moyen, note: acompteForm.note.trim() || null,
    }).select("id, montant, date_paiement, moyen, note").single();
    if (error) { setErr(error.message); setBusy(false); return; }
    setAcomptes((xs) => [data as Acompte, ...xs]);
    setBusy(false); setAcompteOpen(false);
  }
  async function deleteAcompte(id: string) {
    await supabase.from("acomptes").delete().eq("id", id);
    setAcomptes((xs) => xs.filter((a) => a.id !== id));
  }

  // ─── add document (devis / facture) ───
  const emptyDoc = { type: "facture" as FactureDocType, status: "en_attente" as FactureStatus, notes: "" };
  const [docForm, setDocForm] = useState(emptyDoc);
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: "1", unit_price: "" }]);
  const docTotal = useMemo(() => items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0), [items]);
  function openDoc(type: FactureDocType) {
    setDocForm({ ...emptyDoc, type });
    setItems([{ description: "", quantity: "1", unit_price: "" }]);
    setErr(""); setDocOpen(true);
  }
  function addLine(row: LineItem) {
    setItems((xs) => {
      const next = [...xs];
      const emptyIdx = next.findIndex((it) => !it.description.trim() && !it.unit_price);
      if (emptyIdx >= 0) next[emptyIdx] = row; else next.push(row);
      return next;
    });
  }
  function addItemFromActe(id: string) {
    const a = actes.find((x) => x.id === id);
    if (!a) return;
    addLine({ description: a.name, quantity: "1", unit_price: String(a.price), acte_id: a.id });
  }
  function addItemFromPackage(id: string) {
    const p = packages.find((x) => x.id === id);
    if (!p) return;
    if (p.price_override != null) {
      addLine({ description: p.name, quantity: "1", unit_price: String(p.price_override), acte_id: null });
      return;
    }
    p.lines.forEach((l) =>
      addLine({ description: l.name, quantity: String(l.quantity), unit_price: String(l.price), acte_id: l.acte_id })
    );
  }
  async function saveDoc() {
    const validItems = items.filter((it) => it.description.trim() && parseFloat(it.unit_price) >= 0);
    if (validItems.length === 0) { setErr("Ajoutez au moins une ligne."); return; }
    setBusy(true); setErr("");
    const { data: fac, error } = await supabase.from("factures").insert({
      practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
      patient_id: dossier.patient_id, dossier_id: dossier.id,
      type: docForm.type, status: docForm.status, total_price: docTotal, deposit_paid: 0,
      notes: docForm.notes.trim() || null,
    }).select("id, type, status, total_price, created_at, notes").single();
    if (error) { setErr(error.message); setBusy(false); return; }
    const rows = validItems.map((it) => ({
      facture_id: (fac as Doc).id, description: it.description.trim(),
      quantity: parseInt(it.quantity) || 1, unit_price: parseFloat(it.unit_price) || 0,
      acte_id: it.acte_id ?? null,
    }));
    await supabase.from("facture_items").insert(rows);
    setDocs((xs) => [fac as Doc, ...xs]);
    setBusy(false); setDocOpen(false);
  }
  // A facture is an accounting record — it is never deleted, only cancelled
  // (status → "annulee"): the row is kept for the audit trail and drops out of
  // every total. A devis is a draft quote, so it can still be removed outright.
  async function cancelFacture(id: string) {
    const { error } = await supabase.from("factures").update({ status: "annulee" }).eq("id", id);
    if (error) { setErr(error.message); return; }
    setDocs((xs) => xs.map((d) => d.id === id ? { ...d, status: "annulee" } : d));
    setCancelTarget(null);
  }
  async function reactivateFacture(id: string) {
    const { error } = await supabase.from("factures").update({ status: "en_attente" }).eq("id", id);
    if (error) { setErr(error.message); return; }
    setDocs((xs) => xs.map((d) => d.id === id ? { ...d, status: "en_attente" } : d));
  }
  async function deleteDevis(id: string) {
    await supabase.from("factures").delete().eq("id", id);
    setDocs((xs) => xs.filter((d) => d.id !== id));
  }

  async function downloadFacture(d: Doc) {
    const { data: fitems } = await supabase.from("facture_items").select("description, quantity, unit_price").eq("facture_id", d.id);
    await exportFacturePdf({
      factureId: d.id, docType: "facture", appointmentId: null, patientName,
      patientPhone: patient.phone ?? null, patientAddress: patient.address ?? null,
      createdAt: d.created_at, statusLabel: FACTURE_STATUS_LABEL[d.status] ?? d.status,
      items: (fitems ?? []) as { description: string; quantity: number; unit_price: number }[],
      totalPrice: Number(d.total_price), depositPaid: Math.min(totalPaid, Number(d.total_price)),
      notes: d.notes, shopName, shopAddress, shopPhone, logoUrl,
    });
  }

  // ─── feuille de soins (mutuelle) ───
  async function generateFeuille() {
    setFeuilleBusy(true);
    try {
      const { data: pat } = await supabase.from("patients").select("mutuelle_organisme, mutuelle_numero, mutuelle_lien, phone").eq("id", dossier.patient_id).single();
      const { data: facs } = await supabase.from("factures").select("status, type, facture_items(description, quantity, unit_price, acte_date, actes(code))").eq("dossier_id", dossier.id);
      type FI = { description: string; quantity: number; unit_price: number; acte_date: string | null; actes: { code: string | null } | { code: string | null }[] | null };
      const acts: { date: string | null; code: string | null; designation: string; quantity: number; honoraires: number }[] = [];
      ((facs ?? []) as { status: string; type: string; facture_items: FI[] | null }[])
        .filter((f) => f.type === "facture" && f.status !== "annulee")
        .forEach((f) => (f.facture_items ?? []).forEach((it) => {
          const acteRel = it.actes;
          const code = Array.isArray(acteRel) ? (acteRel[0]?.code ?? null) : (acteRel?.code ?? null);
          acts.push({ date: it.acte_date, code, designation: it.description, quantity: it.quantity, honoraires: Number(it.quantity) * Number(it.unit_price) });
        }));
      const total = acts.reduce((s, a) => s + a.honoraires, 0);

      const { data: cons } = await supabase.from("consultations").select("praticien_id").eq("dossier_id", dossier.id).not("praticien_id", "is", null).limit(1);
      let prat: { name: string; inpe: string | null; numero_ordre: string | null } | null = null;
      const pid = (cons ?? [])[0]?.praticien_id as string | undefined;
      if (pid) {
        const { data: p } = await supabase.from("praticiens").select("name, inpe, numero_ordre").eq("id", pid).single();
        prat = (p as { name: string; inpe: string | null; numero_ordre: string | null } | null) ?? null;
      }

      const patM = pat as { mutuelle_organisme: string | null; mutuelle_numero: string | null; mutuelle_lien: string | null; phone: string | null } | null;
      await exportFeuilleSoinsPdf({
        dossierId: dossier.id, dossierTitle: dossier.title, date: today,
        patientName, patientPhone: patM?.phone ?? patient.phone ?? null,
        mutuelleOrganisme: patM?.mutuelle_organisme ?? null, mutuelleNumero: patM?.mutuelle_numero ?? null, mutuelleLien: patM?.mutuelle_lien ?? null,
        praticienName: prat?.name ?? null, praticienInpe: prat?.inpe ?? null, praticienNumeroOrdre: prat?.numero_ordre ?? null,
        acts, total, shopName, shopAddress, shopPhone, logoUrl,
      });
    } finally {
      setFeuilleBusy(false);
    }
  }

  // ─── add visite ───
  const emptyVisite = { motif: "consultation" as ConsultationMotif, exam_date: new Date().toISOString().slice(0, 10), treated_by: "", praticien_id: "", clinical_notes: "", bill: true };
  const [visiteForm, setVisiteForm] = useState(emptyVisite);
  const [visiteBillActes, setVisiteBillActes] = useState<ActeLite[]>([]);
  function openVisite() {
    const cons = actes.find((a) => a.name.toLowerCase() === "consultation") ?? actes[0];
    setVisiteForm({ ...emptyVisite });
    setVisiteBillActes(cons ? [cons] : []);
    setErr(""); setVisiteOpen(true);
  }
  async function saveVisite() {
    if (!visiteForm.exam_date) { setErr("La date est requise."); return; }
    if (visiteForm.exam_date > today) { setErr("Une visite ne peut pas être dans le futur — planifiez plutôt un rendez-vous."); return; }
    setBusy(true); setErr("");
    const { data, error } = await supabase.from("consultations").insert({
      practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
      patient_id: dossier.patient_id, dossier_id: dossier.id,
      motif: visiteForm.motif, exam_date: visiteForm.exam_date,
      treated_by: visiteForm.treated_by.trim() || null, praticien_id: visiteForm.praticien_id || null,
      clinical_notes: visiteForm.clinical_notes.trim() || null,
    }).select("id, motif, exam_date, teeth, treated_by, clinical_notes").single();
    if (error) { setErr(error.message); setBusy(false); return; }
    setVisites((xs) => [data as Visite, ...xs]);

    // Bill the selected actes into the dossier, then refresh the documents list.
    if (visiteForm.bill && visiteBillActes.length > 0) {
      await billActesToDossier(supabase, { practiceId, userId: currentUserId, patientId: dossier.patient_id, dossierId: dossier.id, actes: visiteBillActes, acteDate: visiteForm.exam_date });
      const { data: dd } = await supabase.from("factures").select("id, type, status, total_price, created_at, notes").eq("dossier_id", dossier.id).order("created_at", { ascending: false });
      setDocs((dd ?? []) as Doc[]);
    }

    setBusy(false); setVisiteOpen(false);
  }

  // ─── add rendez-vous (linked to this dossier + patient) ───
  const emptyRdv = { title: "", scheduled_at: "", duration_minutes: "30", type: "consultation" as AppointmentType, notes: "" };
  const [rdvForm, setRdvForm] = useState(emptyRdv);
  function openRdv() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setRdvForm({ ...emptyRdv, scheduled_at: local });
    setErr(""); setRdvOpen(true);
  }
  async function saveRdv() {
    if (!rdvForm.title.trim() || !rdvForm.scheduled_at) { setErr("Le titre et la date sont requis."); return; }
    if (rdvForm.scheduled_at.slice(0, 10) < today) { setErr("Un rendez-vous ne peut pas être dans le passé."); return; }
    setBusy(true); setErr("");
    const { data, error } = await supabase.from("appointments").insert({
      practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
      patient_id: dossier.patient_id, dossier_id: dossier.id,
      title: rdvForm.title.trim(), scheduled_at: new Date(rdvForm.scheduled_at).toISOString(),
      duration_minutes: rdvForm.duration_minutes ? parseInt(rdvForm.duration_minutes) : null,
      type: rdvForm.type, status: "planifie", notes: rdvForm.notes.trim() || null,
    }).select("id, title, scheduled_at, duration_minutes, type, status, notes").single();
    if (error) { setErr(error.message); setBusy(false); return; }
    setRdvs((xs) => [data as Rdv, ...xs].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)));
    setBusy(false); setRdvOpen(false);
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors mb-4">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4" /></svg>
          Retour
        </button>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl shrink-0">📁</div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{dossier.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[dossier.statut] ?? STATUT_STYLE.ouvert}`}>{STATUT_LABEL[dossier.statut] ?? dossier.statut}</span>
            </div>
            <button onClick={() => router.push(`/${locale}/dashboard/patients/${dossier.patient_id}`)} className="text-sm text-teal-600 dark:text-teal-400 hover:underline mt-0.5">{patientName}</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start max-w-6xl pb-8">
        {/* LEFT: facturation + acomptes */}
        <div className="space-y-6">
          {/* Facturation summary */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-5">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Facturation</p>
            <div className="grid grid-cols-3 gap-2 mb-1">
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2.5 text-center">
                <p className="text-[10px] text-zinc-400 uppercase">Facturé</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-white">{totalFacture.toFixed(0)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/10 px-3 py-2.5 text-center">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">Payé</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{totalPaid.toFixed(0)}</p>
              </div>
              <div className={`rounded-xl px-3 py-2.5 text-center ${reste > 0 ? "bg-amber-50 dark:bg-amber-900/10" : "bg-zinc-50 dark:bg-zinc-800/60"}`}>
                <p className={`text-[10px] uppercase ${reste > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-400"}`}>Reste</p>
                <p className={`text-sm font-bold ${reste > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-500"}`}>{reste.toFixed(0)}</p>
              </div>
            </div>
            {totalDevis > 0 && <p className="text-[11px] text-zinc-400 mt-1">Devis estimé : {money(totalDevis)}</p>}
            <button onClick={generateFeuille} disabled={feuilleBusy} className="mt-3 w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors disabled:opacity-60">{feuilleBusy ? "Génération…" : "🧾 Feuille de soins (mutuelle)"}</button>
          </div>

          {/* Documents */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Devis &amp; Factures</p>
              <div className="flex gap-2">
                <button onClick={() => openDoc("devis")} className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 font-medium transition-colors">+ Devis</button>
                <button onClick={() => openDoc("facture")} className="text-xs px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors">+ Facture</button>
              </div>
            </div>
            {loading ? <p className="text-sm text-zinc-400 py-3 text-center">Chargement…</p> : docs.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">Aucun document</p>
            ) : (
              <div className="space-y-2">
                {docs.map((d) => {
                  const annulee = d.status === "annulee";
                  return (
                  <div key={d.id} className={`flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 px-3 py-2.5 ${annulee ? "bg-zinc-50/50 dark:bg-zinc-800/20 opacity-70" : "bg-zinc-50 dark:bg-zinc-800/50"}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${d.type === "devis" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" : "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"}`}>{d.type === "devis" ? "Devis" : "Facture"}</span>
                        {annulee && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Annulée</span>}
                        <span className="text-xs text-zinc-400">{fmtDate(d.created_at)}</span>
                      </div>
                      <p className={`text-sm font-semibold mt-0.5 ${annulee ? "text-zinc-400 line-through" : "text-zinc-900 dark:text-white"}`}>{money(Number(d.total_price))}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.type === "facture" && !annulee && (
                        <button onClick={() => downloadFacture(d)} title="Télécharger la facture (PDF)" className="text-xs px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-teal-400 font-medium transition-colors">⬇ PDF</button>
                      )}
                      {d.type === "facture" ? (
                        annulee ? (
                          <button onClick={() => reactivateFacture(d.id)} title="Réactiver la facture" className="text-sm text-zinc-400 hover:text-teal-500 transition-colors">↩</button>
                        ) : (
                          <button onClick={() => setCancelTarget(d)} title="Annuler la facture" className="text-xs text-zinc-300 hover:text-red-500 transition-colors">✕</button>
                        )
                      ) : (
                        <button onClick={() => deleteDevis(d.id)} title="Supprimer le devis" className="text-xs text-zinc-300 hover:text-red-500 transition-colors">✕</button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Acomptes ledger */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Acomptes / Paiements</p>
              <button onClick={openAcompte} className="text-xs px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors">+ Ajouter acompte</button>
            </div>
            {loading ? <p className="text-sm text-zinc-400 py-3 text-center">Chargement…</p> : acomptes.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">Aucun paiement enregistré</p>
            ) : (
              <div className="space-y-1.5">
                {acomptes.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{money(Number(a.montant))}</p>
                      <p className="text-[11px] text-zinc-400">{fmtDate(a.date_paiement)} · {MOYEN_LABEL[a.moyen] ?? a.moyen}{a.note ? ` · ${a.note}` : ""}</p>
                    </div>
                    <button onClick={() => deleteAcompte(a.id)} title="Supprimer" className="text-xs text-zinc-300 hover:text-red-500 transition-colors shrink-0 ms-2">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: infos + visites */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-5">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Informations</p>
            <div className="space-y-1">
              <DR label="Patient" value={patientName} />
              <DR label="Statut" value={STATUT_LABEL[dossier.statut] ?? dossier.statut} />
              <DR label="Notes" value={dossier.notes} />
              <DR label="Ouvert le" value={fmtDate(dossier.created_at)} />
            </div>
            <div className="flex items-center gap-2 pt-4 mt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => setDeleteOpen(true)} className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">Supprimer</button>
              <div className="ms-auto">
                <button onClick={openEdit} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">✏️ Modifier</button>
              </div>
            </div>
          </div>

          {/* Visites */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Visites <span className="text-zinc-300">({visites.length})</span></p>
              <button onClick={openVisite} className="text-xs px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors">+ Ajouter une visite</button>
            </div>
            {loading ? <p className="text-sm text-zinc-400 py-3 text-center">Chargement…</p> : visites.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">Aucune visite</p>
            ) : (
              <div className="space-y-2">
                {visites.map((v) => (
                  <div key={v.id} onClick={() => router.push(`/${locale}/dashboard/consultations/${v.id}`)} className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">{MOTIF_LABEL[v.motif] ?? v.motif}</span>
                      <span className="text-xs text-zinc-400">{fmtDate(v.exam_date)}</span>
                    </div>
                    {v.teeth && <p className="text-[11px] text-zinc-400 mt-1">Dents : {v.teeth}</p>}
                    {v.clinical_notes && <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{v.clinical_notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rendez-vous */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Rendez-vous <span className="text-zinc-300">({rdvs.length})</span></p>
              <button onClick={openRdv} className="text-xs px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors">+ Ajouter un RDV</button>
            </div>
            {loading ? <p className="text-sm text-zinc-400 py-3 text-center">Chargement…</p> : rdvs.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">Aucun rendez-vous</p>
            ) : (
              <div className="space-y-2">
                {rdvs.map((r) => (
                  <div key={r.id} onClick={() => router.push(`/${locale}/dashboard/appointments/${r.id}`)} className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{r.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${APPT_STATUS_STYLE[r.status] ?? ""}`}>{APPT_STATUS_LABEL[r.status] ?? r.status}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">{fmtDateTime(r.scheduled_at)}{r.duration_minutes ? ` · ${r.duration_minutes} min` : ""} · {APPT_TYPE_LABEL[r.type] ?? r.type}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ordonnances */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Ordonnances <span className="text-zinc-300">({ordos.length})</span></p>
              <button onClick={() => router.push(`/${locale}/dashboard/ordonnances?new=1&patient_id=${dossier.patient_id}&dossier_id=${dossier.id}`)} className="text-xs px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors">+ Ordonnance</button>
            </div>
            {loading ? <p className="text-sm text-zinc-400 py-3 text-center">Chargement…</p> : ordos.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">Aucune ordonnance</p>
            ) : (
              <div className="space-y-2">
                {ordos.map((o) => (
                  <div key={o.id} onClick={() => router.push(`/${locale}/dashboard/ordonnances/${o.id}`)} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600 transition-all">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">💊 Ordonnance</span>
                    <span className="text-xs text-zinc-400">{fmtDate(o.date)}{o.prescriber ? ` · Dr. ${o.prescriber}` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit dossier modal */}
      {editOpen && (
        <Modal title="Modifier le dossier" onClose={() => setEditOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Intitulé <span className="text-red-500">*</span></label>
              <input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Statut</label>
              <select value={editForm.statut} onChange={(e) => setEditForm((f) => ({ ...f, statut: e.target.value as DossierStatut }))} className={inputCls}>
                <option value="ouvert">Ouvert</option>
                <option value="termine">Terminé</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes</label>
              <textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className={`${inputCls} resize-none`} />
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <ModalFooter onCancel={() => setEditOpen(false)} onSave={saveEdit} busy={busy} />
        </Modal>
      )}

      {/* Add acompte modal */}
      {acompteOpen && (
        <Modal title="Ajouter un acompte" onClose={() => setAcompteOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Montant (MAD) <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="0.01" value={acompteForm.montant} onChange={(e) => setAcompteForm((f) => ({ ...f, montant: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date</label>
                <input type="date" value={acompteForm.date_paiement} onChange={(e) => setAcompteForm((f) => ({ ...f, date_paiement: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Moyen de paiement</label>
              <select value={acompteForm.moyen} onChange={(e) => setAcompteForm((f) => ({ ...f, moyen: e.target.value as AcompteMoyen }))} className={inputCls}>
                {MOYENS.map((m) => <option key={m} value={m}>{MOYEN_LABEL[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Note</label>
              <input value={acompteForm.note} onChange={(e) => setAcompteForm((f) => ({ ...f, note: e.target.value }))} className={inputCls} />
            </div>
            {reste > 0 && <p className="text-[11px] text-amber-600 dark:text-amber-400">Reste à payer actuel : {money(reste)}</p>}
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <ModalFooter onCancel={() => setAcompteOpen(false)} onSave={saveAcompte} busy={busy} saveLabel="Enregistrer" />
        </Modal>
      )}

      {/* Add document modal */}
      {docOpen && (
        <Modal title={docForm.type === "devis" ? "Nouveau devis" : "Nouvelle facture"} onClose={() => setDocOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Type</label>
                <select value={docForm.type} onChange={(e) => setDocForm((f) => ({ ...f, type: e.target.value as FactureDocType }))} className={inputCls}>
                  <option value="devis">Devis</option>
                  <option value="facture">Facture</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Statut</label>
                <select value={docForm.status} onChange={(e) => setDocForm((f) => ({ ...f, status: e.target.value as FactureStatus }))} className={inputCls}>
                  {FACTURE_STATUSES.map((s) => <option key={s} value={s}>{FACTURE_STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
            {actes.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Ajouter un acte</label>
                <select value="" onChange={(e) => { if (e.target.value) addItemFromActe(e.target.value); }} className={inputCls}>
                  <option value="">— Choisir un acte —</option>
                  {actes.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.price.toFixed(2)} MAD</option>)}
                </select>
              </div>
            )}
            {packages.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Ajouter un traitement (paquet)</label>
                <select value="" onChange={(e) => { if (e.target.value) addItemFromPackage(e.target.value); }} className={inputCls}>
                  <option value="">— Choisir un traitement —</option>
                  {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Lignes</label>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input placeholder="Description" value={it.description} onChange={(e) => setItems((xs) => xs.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className={`flex-1 ${inputCls}`} />
                    <input type="number" min="1" placeholder="Qté" value={it.quantity} onChange={(e) => setItems((xs) => xs.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} className="w-16 px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    <input type="number" min="0" step="0.01" placeholder="Prix" value={it.unit_price} onChange={(e) => setItems((xs) => xs.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} className="w-24 px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    <button type="button" onClick={() => setItems((xs) => xs.length > 1 ? xs.filter((_, j) => j !== i) : xs)} className="text-zinc-300 hover:text-red-500 text-sm shrink-0">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setItems((xs) => [...xs, { description: "", quantity: "1", unit_price: "" }])} className="mt-2 text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium">+ Ajouter une ligne</button>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-sm text-zinc-500">Total</span>
              <span className="text-base font-bold text-zinc-900 dark:text-white">{money(docTotal)}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes</label>
              <textarea value={docForm.notes} onChange={(e) => setDocForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <ModalFooter onCancel={() => setDocOpen(false)} onSave={saveDoc} busy={busy} saveLabel="Enregistrer" />
        </Modal>
      )}

      {/* Add visite modal */}
      {visiteOpen && (
        <Modal title="Ajouter une visite" onClose={() => setVisiteOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Motif</label>
                <select value={visiteForm.motif} onChange={(e) => setVisiteForm((f) => ({ ...f, motif: e.target.value as ConsultationMotif }))} className={inputCls}>
                  {MOTIFS.map((m) => <option key={m} value={m}>{MOTIF_LABEL[m]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" max={today} value={visiteForm.exam_date} onChange={(e) => setVisiteForm((f) => ({ ...f, exam_date: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Dentiste</label>
              <PraticienSelect value={visiteForm.praticien_id} onChange={(id, name) => setVisiteForm((f) => ({ ...f, praticien_id: id, treated_by: name }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes cliniques</label>
              <textarea value={visiteForm.clinical_notes} onChange={(e) => setVisiteForm((f) => ({ ...f, clinical_notes: e.target.value }))} rows={3} className={`${inputCls} resize-none`} />
            </div>
            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 space-y-3 bg-zinc-50/60 dark:bg-zinc-800/30">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={visiteForm.bill} onChange={(e) => setVisiteForm((f) => ({ ...f, bill: e.target.checked }))} className="w-4 h-4 accent-teal-600" />
                Facturer cette visite
              </label>
              {visiteForm.bill && (
                actes.length > 0 ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Actes à facturer</label>
                    {visiteBillActes.length > 0 && (
                      <div className="space-y-1">
                        {visiteBillActes.map((a, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5">
                            <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{a.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-zinc-500">{a.price.toFixed(2)} MAD</span>
                              <button type="button" onClick={() => setVisiteBillActes((xs) => xs.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-red-500 text-sm">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <select value="" onChange={(e) => { const a = actes.find((x) => x.id === e.target.value); if (a) setVisiteBillActes((xs) => [...xs, a]); }} className={inputCls}>
                      <option value="">+ Ajouter un acte…</option>
                      {actes.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.price.toFixed(2)} MAD</option>)}
                    </select>
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Ajouté à une facture ouverte du dossier (créée si besoin).</span>
                      <span className="font-medium text-zinc-600 dark:text-zinc-300">Total : {visiteBillActes.reduce((s, a) => s + a.price, 0).toFixed(2)} MAD</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">Aucun acte au catalogue — créez un acte « Consultation » pour pouvoir facturer.</p>
                )
              )}
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <ModalFooter onCancel={() => setVisiteOpen(false)} onSave={saveVisite} busy={busy} saveLabel="Enregistrer" />
        </Modal>
      )}

      {/* Add rendez-vous modal */}
      {rdvOpen && (
        <Modal title="Ajouter un rendez-vous" onClose={() => setRdvOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Titre <span className="text-red-500">*</span></label>
              <input value={rdvForm.title} onChange={(e) => setRdvForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex. Contrôle post-opératoire" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date &amp; heure <span className="text-red-500">*</span></label>
                <input type="datetime-local" min={`${today}T00:00`} value={rdvForm.scheduled_at} onChange={(e) => setRdvForm((f) => ({ ...f, scheduled_at: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Durée (min)</label>
                <input type="number" min="0" step="5" value={rdvForm.duration_minutes} onChange={(e) => setRdvForm((f) => ({ ...f, duration_minutes: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Type</label>
              <select value={rdvForm.type} onChange={(e) => setRdvForm((f) => ({ ...f, type: e.target.value as AppointmentType }))} className={inputCls}>
                {APPT_TYPES.map((tp) => <option key={tp} value={tp}>{APPT_TYPE_LABEL[tp]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes</label>
              <textarea value={rdvForm.notes} onChange={(e) => setRdvForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
            </div>
            <p className="text-[11px] text-zinc-400">Le rendez-vous sera rattaché à ce dossier et au patient {patientName}.</p>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <ModalFooter onCancel={() => setRdvOpen(false)} onSave={saveRdv} busy={busy} saveLabel="Enregistrer" />
        </Modal>
      )}

      {/* Cancel facture confirmation */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Annuler cette facture ?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">La facture de {money(Number(cancelTarget.total_price))} sera marquée « Annulée » et retirée du total facturé. Elle reste conservée pour l'historique.</p>
            <p className="text-xs text-zinc-400 mb-6">Vous pourrez la réactiver à tout moment.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelTarget(null)} className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Retour</button>
              <button onClick={() => cancelFacture(cancelTarget.id)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">Annuler la facture</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dossier */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Supprimer ce dossier ?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Les acomptes de ce dossier seront supprimés. Les visites et factures liées seront détachées (non supprimées).</p>
            <p className="text-xs text-zinc-400 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteOpen(false)} className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Annuler</button>
              <button onClick={deleteDossier} disabled={busy} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{busy ? "Suppression…" : "Supprimer"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="font-semibold text-zinc-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, busy, saveLabel = "Enregistrer" }: { onCancel: () => void; onSave: () => void; busy: boolean; saveLabel?: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 -mx-6 -mb-5 mt-5">
      <div className="ms-auto flex items-center gap-3">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Annuler</button>
        <button onClick={onSave} disabled={busy} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{busy ? "Enregistrement…" : saveLabel}</button>
      </div>
    </div>
  );
}
