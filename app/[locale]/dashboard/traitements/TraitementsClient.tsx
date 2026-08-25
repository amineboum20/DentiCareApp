"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { Traitement, TreatmentCategory } from "@/types/database";
import { DR } from "@/components/DetailRow";

interface Props {
  initialTraitements: Traitement[];
  userId: string;
}

const emptyForm = {
  name: "",
  category: "autre" as TreatmentCategory,
  price: "",
  duration_minutes: "",
  description: "",
  notes: "",
};

const CATEGORY_STYLE: Record<string, string> = {
  nettoyage:   "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  obturation:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  extraction:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  couronne:    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  implant:     "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  orthodontie: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  blanchiment: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  prothese:    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  autre:       "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const CATEGORIES: TreatmentCategory[] = [
  "nettoyage", "obturation", "extraction", "couronne", "implant",
  "orthodontie", "blanchiment", "prothese", "autre",
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function TraitementsClient({ initialTraitements, userId }: Props) {
  const t = useTranslations("traitements");
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [traitements, setTraitements] = useState<Traitement[]>(initialTraitements);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTraitement, setEditingTraitement] = useState<Traitement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Traitement | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Traitement | null>(null);

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    const found = traitements.find((t) => t.id === id);
    if (found) setDetail(found);
  }, [searchParams]);

  const filtered = useMemo(() =>
    traitements.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
    ),
    [traitements, search]
  );

  function openAdd() {
    setEditingTraitement(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(t: Traitement) {
    setEditingTraitement(t);
    setForm({
      name: t.name,
      category: t.category,
      price: String(t.price),
      duration_minutes: t.duration_minutes != null ? String(t.duration_minutes) : "",
      description: t.description ?? "",
      notes: t.notes ?? "",
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
    if (!form.name.trim() || !form.price) {
      setError(t("form.requiredError"));
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      category: form.category,
      price: parseFloat(form.price),
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes, 10) : null,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editingTraitement) {
      const { data, error: err } = await supabase
        .from("traitements")
        .update(payload)
        .eq("id", editingTraitement.id)
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setTraitements((ts) => ts.map((t) => (t.id === data.id ? (data as Traitement) : t)));
    } else {
      const { data, error: err } = await supabase
        .from("traitements")
        .insert({ ...payload, user_id: userId })
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setTraitements((ts) => [data as Traitement, ...ts]);
    }

    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("traitements").delete().eq("id", deleteTarget.id);
    setTraitements((ts) => ts.filter((t) => t.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
        >
          + {t("newTraitement")}
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
            <span className="text-4xl mb-3">{search ? "🔍" : "💊"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {search ? t("noResults") : t("noTraitements")}
            </p>
            {!search && (
              <button
                onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
              >
                + {t("newTraitement")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.name")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.category")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.price")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.duration")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tr) => (
                  <tr
                    key={tr.id}
                    onClick={() => setDetail(tr)}
                    className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">{tr.name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[tr.category] ?? CATEGORY_STYLE.autre}`}>
                        {tr.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{tr.price.toFixed(2)} MAD</td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">
                      {tr.duration_minutes != null ? `${tr.duration_minutes} min` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 dark:text-teal-400 text-lg font-bold">
                  💊
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{detail.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[detail.category] ?? CATEGORY_STYLE.autre}`}>
                    {detail.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 space-y-1">
              <DR label={t("columns.price")} value={`${detail.price.toFixed(2)} MAD`} />
              <DR label={t("columns.duration")} value={detail.duration_minutes != null ? `${detail.duration_minutes} min` : null} />
              <DR label={t("form.description")} value={detail.description} />
              <DR label={t("form.notes")} value={detail.notes} />
            </div>
            <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => { setDeleteTarget(detail); setDetail(null); }}
                className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
              >
                Supprimer
              </button>
              <div className="ms-auto">
                <button
                  onClick={() => { openEdit(detail); setDetail(null); }}
                  className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
                >
                  ✏️ Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                {editingTraitement ? t("form.editTitle") : t("form.addTitle")}
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
                  {t("form.name")} <span className="text-red-500">*</span>
                </label>
                <input type="text" {...field("name")} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.category")} <span className="text-red-500">*</span>
                </label>
                <select {...field("category")} className={inputCls}>
                  {CATEGORIES.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.price")} <span className="text-red-500">*</span>
                  </label>
                  <input type="number" min="0" step="0.01" {...field("price")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.duration")}
                  </label>
                  <input type="number" min="0" step="1" {...field("duration_minutes")} placeholder="minutes" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.description")}
                </label>
                <textarea {...field("description")} rows={2} className={`${inputCls} resize-none`} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.notes")}
                </label>
                <textarea {...field("notes")} rows={2} className={`${inputCls} resize-none`} />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editingTraitement && (
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(editingTraitement); setModalOpen(false); }}
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
