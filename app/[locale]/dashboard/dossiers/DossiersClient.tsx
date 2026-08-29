"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { DossierWithPatient, DossierType, Patient } from "@/types/database";
import { useAppContext } from "@/components/AppContext";

interface Props {
  initialDossiers: DossierWithPatient[];
  patients: Pick<Patient, "id" | "first_name" | "last_name">[];
}

const emptyForm = {
  patient_id: "",
  type: "examen" as DossierType,
  exam_date: "",
  next_exam_date: "",
  treated_by: "",
  dental_notes: "",
};

const DOSSIER_TYPE_STYLE: Record<string, string> = {
  examen:  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  soin:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  bilan:   "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  urgence: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  autre:   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function DossiersClient({ initialDossiers, patients }: Props) {
  const t = useTranslations("dossiers");
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const { practiceId, currentUserId } = useAppContext();

  const [dossiers, setDossiers] = useState<DossierWithPatient[]>(initialDossiers);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDossier, setEditingDossier] = useState<DossierWithPatient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DossierWithPatient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    router.push(`/${locale}/dashboard/dossiers/${id}`);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const patientId = searchParams.get("patient_id") ?? "";
    setEditingDossier(null);
    setForm({ ...emptyForm, patient_id: patientId });
    setError("");
    setModalOpen(true);
  }, [searchParams]);

  const filtered = useMemo(() =>
    dossiers.filter((d) => {
      const name = `${d.patients.first_name} ${d.patients.last_name}`.toLowerCase();
      return name.includes(search.toLowerCase());
    }),
    [dossiers, search]
  );

  function openAdd() {
    setEditingDossier(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(d: DossierWithPatient) {
    setEditingDossier(d);
    setForm({
      patient_id: d.patient_id,
      type: d.type,
      exam_date: d.exam_date,
      next_exam_date: d.next_exam_date ?? "",
      treated_by: d.treated_by ?? "",
      dental_notes: d.dental_notes ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  function field(key: keyof typeof emptyForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    if (!form.exam_date.trim()) {
      setError(t("form.requiredError"));
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      patient_id: form.patient_id.trim(),
      type: form.type,
      exam_date: form.exam_date,
      next_exam_date: form.next_exam_date || null,
      treated_by: form.treated_by.trim() || null,
      dental_notes: form.dental_notes.trim() || null,
    };

    if (editingDossier) {
      const { data, error: err } = await supabase
        .from("dossiers")
        .update(payload)
        .eq("id", editingDossier.id)
        .select("*, patients(first_name, last_name)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setDossiers((ds) => ds.map((d) => (d.id === data.id ? (data as DossierWithPatient) : d)));
    } else {
      const { data, error: err } = await supabase
        .from("dossiers")
        .insert({ ...payload, practice_id: practiceId, created_by: currentUserId, user_id: currentUserId })
        .select("*, patients(first_name, last_name)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setDossiers((ds) => [data as DossierWithPatient, ...ds]);
    }

    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("dossiers").delete().eq("id", deleteTarget.id);
    setDossiers((ds) => ds.filter((d) => d.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  const DOSSIER_TYPES: DossierType[] = ["examen", "soin", "bilan", "urgence", "autre"];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
        >
          + {t("newDossier")}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-9 pe-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">{search ? "🔍" : "🦷"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {search ? t("noResults") : t("noDossiers")}
            </p>
            {!search && (
              <button
                onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
              >
                + {t("newDossier")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.patient")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.type")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.examDate")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.treatedBy")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{"Date création"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/${locale}/dashboard/dossiers/${d.id}`)}
                    className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">
                      {d.patients.first_name} {d.patients.last_name}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOSSIER_TYPE_STYLE[d.type] ?? DOSSIER_TYPE_STYLE.autre}`}>
                        {d.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{fmtDate(d.exam_date)}</td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{d.treated_by ?? "—"}</td>
                    <td className="px-5 py-3.5 text-zinc-400">{fmtDate(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                {editingDossier ? t("form.editTitle") : t("form.addTitle")}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.patientId")} <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.patient_id}
                  onChange={(e) => setForm(f => ({ ...f, patient_id: e.target.value }))}
                  className={inputCls}
                  required
                >
                  <option value="">— Sélectionner un patient —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.type")} <span className="text-red-500">*</span>
                </label>
                <select {...field("type")} className={inputCls}>
                  {DOSSIER_TYPES.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.examDate")} <span className="text-red-500">*</span>
                  </label>
                  <input type="date" {...field("exam_date")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.nextExamDate")}
                  </label>
                  <input type="date" {...field("next_exam_date")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.treatedBy")}
                </label>
                <input type="text" {...field("treated_by")} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.dentalNotes")}
                </label>
                <textarea {...field("dental_notes")} rows={3} className={`${inputCls} resize-none`} />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editingDossier && (
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(editingDossier); setModalOpen(false); }}
                  className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
                >
                  Supprimer
                </button>
              )}
              <div className="ms-auto flex items-center gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t("form.cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                >
                  {saving ? t("form.saving") : t("form.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("deleteConfirm.title")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              {t("deleteConfirm.message")}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t("deleteConfirm.cancel")}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                {t("deleteConfirm.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
