"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { DossierWithPatient } from "@/types/database";
import { DR } from "@/components/DetailRow";

interface Props {
  dossier: DossierWithPatient;
  locale: string;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

const DOSSIER_TYPE_STYLE: Record<string, string> = {
  examen:  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  soin:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  bilan:   "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  urgence: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  autre:   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const DOSSIER_TYPES = ["examen", "soin", "bilan", "urgence", "autre"] as const;

const emptyForm = {
  type: "examen", exam_date: "", next_exam_date: "", treated_by: "", dental_notes: "",
};

export default function DossierDetailClient({ dossier: initialDossier, locale }: Props) {
  const t = useTranslations("dossiers");
  const supabase = createClient();
  const router = useRouter();

  const [dossier, setDossier] = useState<DossierWithPatient>(initialDossier);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patientName = dossier.patients
    ? `${(dossier.patients as { first_name: string; last_name: string }).first_name} ${(dossier.patients as { first_name: string; last_name: string }).last_name}`
    : null;

  function openEdit() {
    setForm({
      type: dossier.type,
      exam_date: dossier.exam_date ?? "",
      next_exam_date: dossier.next_exam_date ?? "",
      treated_by: dossier.treated_by ?? "",
      dental_notes: dossier.dental_notes ?? "",
    });
    setFormError("");
    setModalOpen(true);
  }

  function field(key: keyof typeof emptyForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    if (!form.exam_date) { setFormError("La date d'examen est requise."); return; }
    setSaving(true); setFormError("");
    const payload = {
      type: form.type,
      exam_date: form.exam_date,
      next_exam_date: form.next_exam_date || null,
      treated_by: form.treated_by.trim() || null,
      dental_notes: form.dental_notes.trim() || null,
    };
    const { data, error } = await supabase.from("dossiers").update(payload).eq("id", dossier.id).select("*, patients(first_name, last_name)").single();
    if (error) { setFormError(error.message); setSaving(false); return; }
    setDossier(data as DossierWithPatient);
    setSaving(false); setModalOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("dossiers").delete().eq("id", dossier.id);
    router.push(`/${locale}/dashboard/dossiers`);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors mb-4"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Retour
        </button>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl shrink-0">🗂️</div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dossier {dossier.type}</h1>
            {patientName && (
              <button
                onClick={() => router.push(`/${locale}/dashboard/patients/${dossier.patient_id}`)}
                className="text-sm text-teal-600 dark:text-teal-400 hover:underline mt-0.5"
              >
                {patientName}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Informations</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOSSIER_TYPE_STYLE[dossier.type] ?? DOSSIER_TYPE_STYLE.autre}`}>
              {dossier.type}
            </span>
          </div>
          <div className="space-y-1">
            <DR label="Patient" value={patientName} />
            <DR label="Date d'examen" value={fmtDate(dossier.exam_date)} />
            <DR label="Prochain contrôle" value={fmtDate(dossier.next_exam_date)} />
            <DR label="Traité par" value={dossier.treated_by ? `Dr. ${dossier.treated_by}` : null} />
            <DR label="Notes cliniques" value={dossier.dental_notes} />
            <DR label="Créé le" value={fmtDate(dossier.created_at)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 pb-8">
          <button onClick={() => setDeleteOpen(true)}
            className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
            Supprimer
          </button>
          <div className="ms-auto">
            <button onClick={openEdit}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
              ✏️ Modifier
            </button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">{t("form.editTitle")}</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.type")} <span className="text-red-500">*</span></label>
                <select {...field("type")} className={inputCls}>
                  {DOSSIER_TYPES.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.examDate")} <span className="text-red-500">*</span></label>
                  <input type="date" {...field("exam_date")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.nextExamDate")}</label>
                  <input type="date" {...field("next_exam_date")} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.treatedBy")}</label>
                <input {...field("treated_by")} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.dentalNotes")}</label>
                <textarea {...field("dental_notes")} rows={3} className={`${inputCls} resize-none`} />
              </div>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="ms-auto flex items-center gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  {t("form.cancel")}
                </button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                  {saving ? t("form.saving") : t("form.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Supprimer ce dossier ?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
