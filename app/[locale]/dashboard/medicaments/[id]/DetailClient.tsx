"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { Medicament } from "@/types/database";
import { DR } from "@/components/DetailRow";
import AuditInfo from "@/components/AuditInfo";

interface Props {
  medicament: Medicament;
  locale: string;
}

export default function MedicamentDetailClient({ medicament, locale }: Props) {
  const t = useTranslations("medicaments");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [med, setMed] = useState<Medicament>(medicament);
  const [modalOpen, setModalOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: med.name, form: med.form ?? "", default_posologie: med.default_posologie ?? "",
    default_duree: med.default_duree ?? "", default_quantite: med.default_quantite ?? "",
    default_instructions: med.default_instructions ?? "", notes: med.notes ?? "",
  });

  function openEdit() {
    setForm({
      name: med.name, form: med.form ?? "", default_posologie: med.default_posologie ?? "",
      default_duree: med.default_duree ?? "", default_quantite: med.default_quantite ?? "",
      default_instructions: med.default_instructions ?? "", notes: med.notes ?? "",
    });
    setError(""); setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError(t("errNameRequired")); return; }
    setSaving(true); setError("");
    const payload = {
      name: form.name.trim(), form: form.form.trim() || null,
      default_posologie: form.default_posologie.trim() || null,
      default_duree: form.default_duree.trim() || null,
      default_quantite: form.default_quantite.trim() || null,
      default_instructions: form.default_instructions.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { data, error: e } = await supabase.from("medicaments").update(payload).eq("id", med.id).select("*").single();
    if (e) { setError(e.message); setSaving(false); return; }
    setMed(data as Medicament); setSaving(false); setModalOpen(false);
  }

  async function handleArchive() {
    setArchiving(true);
    await supabase.from("medicaments").update({ archived_at: new Date().toISOString() }).eq("id", med.id);
    router.push(`/${locale}/dashboard/medicaments`);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      <button onClick={() => router.push(`/${locale}/dashboard/medicaments`)} className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors mb-4">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4" /></svg>
        {t("backToList")}
      </button>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl shrink-0">💊</div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{med.name}</h1>
          {med.form && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{med.form}</p>}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">{t("informations")}</h2>
        <div className="space-y-1">
          <DR label={t("form.form")} value={med.form} />
          <DR label={t("form.posologie")} value={med.default_posologie} />
          <DR label={t("form.duree")} value={med.default_duree} />
          <DR label={t("form.quantite")} value={med.default_quantite} />
          <DR label={t("form.instructions")} value={med.default_instructions} />
          <DR label={t("form.notes")} value={med.notes} />
        </div>
        <AuditInfo createdBy={med.created_by} createdAt={med.created_at} updatedBy={med.updated_by} updatedAt={med.updated_at} className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800" />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-6">
        <button onClick={() => setArchiveOpen(true)} className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">{t("archive")}</button>
        <div className="ms-auto">
          <button onClick={openEdit} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">✏️ {t("edit")}</button>
        </div>
      </div>

      {/* Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">{t("editTitle")}</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.name")} <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("form.namePlaceholder")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.form")}</label>
                  <input value={form.form} onChange={(e) => setForm((f) => ({ ...f, form: e.target.value }))} placeholder={t("form.formPlaceholder")} className={inputCls} />
                </div>
              </div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide pt-1">{t("form.defaults")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.posologie")}</label>
                  <input value={form.default_posologie} onChange={(e) => setForm((f) => ({ ...f, default_posologie: e.target.value }))} placeholder={t("form.posologiePlaceholder")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.duree")}</label>
                  <input value={form.default_duree} onChange={(e) => setForm((f) => ({ ...f, default_duree: e.target.value }))} placeholder={t("form.dureePlaceholder")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.quantite")}</label>
                  <input value={form.default_quantite} onChange={(e) => setForm((f) => ({ ...f, default_quantite: e.target.value }))} placeholder={t("form.quantitePlaceholder")} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.instructions")}</label>
                <input value={form.default_instructions} onChange={(e) => setForm((f) => ({ ...f, default_instructions: e.target.value }))} placeholder={t("form.instructionsPlaceholder")} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.notes")}</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="ms-auto flex items-center gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">{t("cancel")}</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{saving ? t("saving") : t("save")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      {archiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("archiveQ")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t("archiveBody")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveOpen(false)} className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">{t("cancel")}</button>
              <button onClick={handleArchive} disabled={archiving} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{archiving ? "…" : t("archive")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
