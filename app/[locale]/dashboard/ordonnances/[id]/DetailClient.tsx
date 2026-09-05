"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { OrdonnanceWithPatient, OrdonnanceLigne } from "@/types/database";
import { DR } from "@/components/DetailRow";
import { useAppContext } from "@/components/AppContext";

interface Props {
  ordonnance: OrdonnanceWithPatient & {
    dossiers?: { id: string; title: string } | { id: string; title: string }[] | null;
    consultations?: { id: string; exam_date: string; motif: string } | { id: string; exam_date: string; motif: string }[] | null;
  };
  lignes: OrdonnanceLigne[];
  locale: string;
}

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

export default function OrdonnanceDetailClient({ ordonnance, lignes, locale }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { shopName, shopAddress, shopPhone, logoUrl } = useAppContext();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patient = ordonnance.patients as { first_name: string; last_name: string; phone?: string | null } | null;
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "—";
  const dossier = one(ordonnance.dossiers);
  const visite = one(ordonnance.consultations);

  async function exportPdf() {
    const { exportOrdonnancePdf } = await import("@/utils/pdf-export");
    await exportOrdonnancePdf({
      ordonnanceId: ordonnance.id,
      patientName,
      patientPhone: patient?.phone ?? null,
      date: ordonnance.date,
      prescriber: ordonnance.prescriber,
      lines: lignes.map((l) => ({ name: l.name, posologie: l.posologie, duree: l.duree, quantite: l.quantite, instructions: l.instructions })),
      notes: ordonnance.notes,
      shopName, shopAddress, shopPhone, logoUrl,
    });
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("ordonnances").delete().eq("id", ordonnance.id);
    router.push(`/${locale}/dashboard/ordonnances`);
  }

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
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Ordonnance</h1>
            <button onClick={() => router.push(`/${locale}/dashboard/patients/${ordonnance.patient_id}`)} className="text-sm text-teal-600 dark:text-teal-400 hover:underline mt-0.5">{patientName}</button>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Info */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">Informations</h2>
          <div className="space-y-1">
            <DR label="Patient" value={patientName} />
            <DR label="Date" value={fmtDate(ordonnance.date)} />
            <DR label="Prescripteur" value={ordonnance.prescriber ? `Dr. ${ordonnance.prescriber}` : null} />
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
            <DR label="Notes" value={ordonnance.notes} />
          </div>
        </div>

        {/* Médicaments */}
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

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2 pb-8">
          <button onClick={() => setDeleteOpen(true)} className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">Supprimer</button>
          <button onClick={exportPdf} className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors">🖨️ PDF</button>
        </div>
      </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Supprimer cette ordonnance ?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteOpen(false)} className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Annuler</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{deleting ? "Suppression…" : "Supprimer"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
