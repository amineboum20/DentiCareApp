"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { OrdonnanceWithPatient, OrdonnanceLigne, OrdonnanceStatus } from "@/types/database";
import { DR } from "@/components/DetailRow";
import { useAppContext } from "@/components/AppContext";
import { PraticienSelect } from "@/components/PraticienSelect";

interface Props {
  ordonnance: OrdonnanceWithPatient & {
    dossiers?: { id: string; title: string } | { id: string; title: string }[] | null;
    consultations?: { id: string; exam_date: string; motif: string } | { id: string; exam_date: string; motif: string }[] | null;
  };
  lignes: OrdonnanceLigne[];
  locale: string;
}

type MedLite = { id: string; name: string; default_posologie: string | null; default_duree: string | null; default_quantite: string | null; default_instructions: string | null };
type EditLine = { medicament_id: string | null; name: string; posologie: string; duree: string; quantite: string; instructions: string };

const MOTIF_LABEL: Record<string, string> = {
  consultation: "Consultation", controle: "Contrôle", soin: "Soin", urgence: "Urgence", autre: "Autre",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}
function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
}

export default function OrdonnanceDetailClient({ ordonnance: initial, lignes: initialLignes, locale }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { shopName, shopAddress, shopPhone, logoUrl } = useAppContext();

  const [ordo, setOrdo] = useState<OrdonnanceWithPatient>(initial);
  const [lignes, setLignes] = useState<OrdonnanceLigne[]>(initialLignes);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ date: "", prescriber: "", praticien_id: "", notes: "" });
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [medications, setMedications] = useState<MedLite[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const patient = ordo.patients as { first_name: string; last_name: string; phone?: string | null } | null;
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "—";
  const dossier = one(initial.dossiers);
  const visite = one(initial.consultations);
  const annulee = ordo.status === "annulee";

  useEffect(() => {
    if (!editOpen) return;
    supabase.from("medicaments").select("id, name, default_posologie, default_duree, default_quantite, default_instructions").is("archived_at", null).order("name")
      .then(({ data }) => setMedications((data ?? []) as MedLite[]));
  }, [editOpen, supabase]);

  function openEdit() {
    setEditForm({ date: ordo.date, prescriber: ordo.prescriber ?? "", praticien_id: ordo.praticien_id ?? "", notes: ordo.notes ?? "" });
    setEditLines(lignes.length
      ? lignes.map((l) => ({ medicament_id: l.medicament_id, name: l.name, posologie: l.posologie ?? "", duree: l.duree ?? "", quantite: l.quantite ?? "", instructions: l.instructions ?? "" }))
      : [{ medicament_id: null, name: "", posologie: "", duree: "", quantite: "", instructions: "" }]);
    setError(""); setEditOpen(true);
  }

  async function saveEdit() {
    const valid = editLines.filter((l) => l.name.trim());
    if (valid.length === 0) { setError("Ajoutez au moins un médicament."); return; }
    setSaving(true); setError("");
    const { data, error: e } = await supabase.from("ordonnances").update({
      date: editForm.date, prescriber: editForm.prescriber.trim() || null, praticien_id: editForm.praticien_id || null, notes: editForm.notes.trim() || null,
    }).eq("id", ordo.id).select("*, patients(first_name, last_name, phone)").single();
    if (e || !data) { setError(e?.message ?? "Erreur"); setSaving(false); return; }
    await supabase.from("ordonnance_lignes").delete().eq("ordonnance_id", ordo.id);
    const { data: newLines } = await supabase.from("ordonnance_lignes").insert(valid.map((l, i) => ({
      ordonnance_id: ordo.id, medicament_id: l.medicament_id ?? null, name: l.name.trim(),
      posologie: l.posologie.trim() || null, duree: l.duree.trim() || null, quantite: l.quantite.trim() || null,
      instructions: l.instructions.trim() || null, sort_order: i,
    }))).select("*");
    setOrdo(data as OrdonnanceWithPatient);
    setLignes((newLines ?? []) as OrdonnanceLigne[]);
    setSaving(false); setEditOpen(false);
  }

  async function cancelOrdo() {
    setBusy(true);
    const { error: e } = await supabase.from("ordonnances").update({ status: "annulee" }).eq("id", ordo.id);
    setBusy(false);
    if (e) return;
    setOrdo((o) => ({ ...o, status: "annulee" as OrdonnanceStatus }));
    setCancelOpen(false);
  }
  async function reactivate() {
    const { error: e } = await supabase.from("ordonnances").update({ status: "active" }).eq("id", ordo.id);
    if (!e) setOrdo((o) => ({ ...o, status: "active" as OrdonnanceStatus }));
  }

  async function exportPdf() {
    const { exportOrdonnancePdf } = await import("@/utils/pdf-export");
    await exportOrdonnancePdf({
      ordonnanceId: ordo.id,
      patientName,
      patientPhone: patient?.phone ?? null,
      date: ordo.date,
      prescriber: ordo.prescriber,
      lines: lignes.map((l) => ({ name: l.name, posologie: l.posologie, duree: l.duree, quantite: l.quantite, instructions: l.instructions })),
      notes: ordo.notes,
      shopName, shopAddress, shopPhone, logoUrl,
    });
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      <div className="mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors mb-4">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4" /></svg>
          Retour
        </button>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl shrink-0">💊</div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Ordonnance</h1>
              {annulee && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Annulée</span>}
            </div>
            <button onClick={() => router.push(`/${locale}/dashboard/patients/${ordo.patient_id}`)} className="text-sm text-teal-600 dark:text-teal-400 hover:underline mt-0.5">{patientName}</button>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-3xl">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">Informations</h2>
          <div className="space-y-1">
            <DR label="Patient" value={patientName} />
            <DR label="Date" value={fmtDate(ordo.date)} />
            <DR label="Prescripteur" value={ordo.prescriber ? `Dr. ${ordo.prescriber}` : null} />
            {visite && (
              <div className="flex gap-3 py-0.5">
                <span className="text-xs text-zinc-400 w-32 shrink-0 pt-0.5">Visite liée</span>
                <button onClick={() => router.push(`/${locale}/dashboard/consultations/${visite.id}`)} className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline text-left">{fmtDate(visite.exam_date)} — {MOTIF_LABEL[visite.motif] ?? visite.motif} →</button>
              </div>
            )}
            {dossier && (
              <div className="flex gap-3 py-0.5">
                <span className="text-xs text-zinc-400 w-32 shrink-0 pt-0.5">Dossier</span>
                <button onClick={() => router.push(`/${locale}/dashboard/dossiers/${dossier.id}`)} className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline text-left">{dossier.title} →</button>
              </div>
            )}
            <DR label="Notes" value={ordo.notes} />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
            Médicaments
            <span className="ml-2 text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{lignes.length}</span>
          </h2>
          {lignes.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">Aucun médicament</p>
          ) : (
            <div className="space-y-3">
              {lignes.map((l, i) => (
                <div key={l.id} className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{i + 1}. {l.name}</p>
                  {(l.posologie || l.duree || l.quantite) && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {[l.posologie && `Posologie : ${l.posologie}`, l.duree && `Durée : ${l.duree}`, l.quantite && `Quantité : ${l.quantite}`].filter(Boolean).join("   ·   ")}
                    </p>
                  )}
                  {l.instructions && <p className="text-xs text-zinc-400 italic mt-1">{l.instructions}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 pb-8">
          {annulee ? (
            <button onClick={reactivate} className="px-4 py-2 rounded-lg border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-sm font-medium transition-colors">↩ Réactiver</button>
          ) : (
            <button onClick={() => setCancelOpen(true)} className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">Annuler l&apos;ordonnance</button>
          )}
          <button onClick={exportPdf} className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors">🖨️ PDF</button>
          {!annulee && (
            <div className="ms-auto">
              <button onClick={openEdit} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">✏️ Modifier</button>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Modifier l&apos;ordonnance</h2>
              <button onClick={() => setEditOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date</label>
                  <input type="date" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Prescripteur (dentiste)</label>
                  <PraticienSelect value={editForm.praticien_id} onChange={(id, name) => setEditForm((f) => ({ ...f, praticien_id: id, prescriber: name }))} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Médicaments <span className="text-red-500">*</span></label>
                <div className="space-y-3">
                  {editLines.map((l, i) => (
                    <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 bg-zinc-50/60 dark:bg-zinc-800/30">
                      {medications.length > 0 && (
                        <select value={l.medicament_id ?? ""} onChange={(e) => {
                          const m = medications.find((x) => x.id === e.target.value);
                          setEditLines((xs) => xs.map((x, j) => j === i ? (m ? { medicament_id: m.id, name: m.name, posologie: m.default_posologie ?? "", duree: m.default_duree ?? "", quantite: m.default_quantite ?? "", instructions: m.default_instructions ?? "" } : { ...x, medicament_id: null }) : x));
                        }} className={inputCls}>
                          <option value="">— Choisir dans le catalogue (ou saisir ci-dessous) —</option>
                          {medications.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      )}
                      <div className="flex gap-2 items-center">
                        <input placeholder="Médicament" value={l.name} onChange={(e) => setEditLines((xs) => xs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={`flex-1 ${inputCls}`} />
                        <button type="button" onClick={() => setEditLines((xs) => xs.length > 1 ? xs.filter((_, j) => j !== i) : xs)} className="text-zinc-300 hover:text-red-500 text-sm shrink-0">✕</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input placeholder="Posologie" value={l.posologie} onChange={(e) => setEditLines((xs) => xs.map((x, j) => j === i ? { ...x, posologie: e.target.value } : x))} className={inputCls} />
                        <input placeholder="Durée" value={l.duree} onChange={(e) => setEditLines((xs) => xs.map((x, j) => j === i ? { ...x, duree: e.target.value } : x))} className={inputCls} />
                        <input placeholder="Quantité" value={l.quantite} onChange={(e) => setEditLines((xs) => xs.map((x, j) => j === i ? { ...x, quantite: e.target.value } : x))} className={inputCls} />
                      </div>
                      <input placeholder="Instructions" value={l.instructions} onChange={(e) => setEditLines((xs) => xs.map((x, j) => j === i ? { ...x, instructions: e.target.value } : x))} className={inputCls} />
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setEditLines((xs) => [...xs, { medicament_id: null, name: "", posologie: "", duree: "", quantite: "", instructions: "" }])} className="mt-2 text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium">+ Ajouter un médicament</button>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="ms-auto flex items-center gap-3">
                <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Annuler</button>
                <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{saving ? "Enregistrement…" : "Enregistrer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Annuler cette ordonnance ?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Elle sera marquée « Annulée » et conservée pour l&apos;historique.</p>
            <p className="text-xs text-zinc-400 mb-6">Vous pourrez la réactiver à tout moment.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelOpen(false)} className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Retour</button>
              <button onClick={cancelOrdo} disabled={busy} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{busy ? "…" : "Annuler l'ordonnance"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
