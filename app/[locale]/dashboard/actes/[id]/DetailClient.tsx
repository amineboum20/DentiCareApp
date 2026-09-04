"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Acte, Supplier, TreatmentCategory } from "@/types/database";
import { DR } from "@/components/DetailRow";

interface Props {
  acte: Acte;
  locale: string;
}

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

const emptyForm = {
  name: "", category: "autre", price: "", duration_minutes: "",
  description: "", notes: "",
};

export default function ActeDetailClient({ acte: initialActe, locale }: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [acte, setActe] = useState<Acte>(initialActe);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase
      .from("treatment_suppliers")
      .select("supplier_id, suppliers(*)")
      .eq("treatment_id", acte.id)
      .then(({ data }) => {
        const linked = ((data ?? []) as unknown as { suppliers: Supplier }[]).map((r) => r.suppliers).filter(Boolean);
        setSuppliers(linked);
        setSuppliersLoading(false);
      });
  }, [acte.id]);

  function openEdit() {
    setForm({
      name: acte.name,
      category: acte.category ?? "autre",
      price: String(acte.price ?? ""),
      duration_minutes: String(acte.duration_minutes ?? ""),
      description: acte.description ?? "",
      notes: acte.notes ?? "",
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
    if (!form.name.trim()) { setFormError("Le nom est requis."); return; }
    setSaving(true); setFormError("");
    const payload = {
      name: form.name.trim(),
      category: form.category || "autre",
      price: form.price ? parseFloat(form.price) : 0,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { data, error } = await supabase.from("actes").update(payload).eq("id", acte.id).select().single();
    if (error) { setFormError(error.message); setSaving(false); return; }
    setActe(data as Acte);
    setSaving(false); setModalOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("actes").delete().eq("id", acte.id);
    router.push(`/${locale}/dashboard/actes`);
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
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl shrink-0">🦷</div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{acte.name}</h1>
            {acte.category && (
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${CATEGORY_STYLE[acte.category] ?? CATEGORY_STYLE.autre}`}>
                {acte.category}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">Informations</h2>
          <div className="space-y-1">
            <DR label="Prix" value={acte.price != null ? `${Number(acte.price).toFixed(2)} MAD` : null} />
            <DR label="Durée" value={acte.duration_minutes != null ? `${acte.duration_minutes} min` : null} />
            <DR label="Description" value={acte.description} />
            <DR label="Notes" value={acte.notes} />
          </div>
        </div>

        {/* Linked suppliers */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
            Fournisseurs liés
            {!suppliersLoading && (
              <span className="ml-2 text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{suppliers.length}</span>
            )}
          </h2>
          {suppliersLoading ? (
            <div className="flex justify-center py-4">
              <svg className="w-5 h-5 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : suppliers.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">Aucun fournisseur lié</p>
          ) : (
            <div className="space-y-2">
              {suppliers.map(s => (
                <button key={s.id}
                  onClick={() => router.push(`/${locale}/dashboard/suppliers/${s.id}`)}
                  className="w-full flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-sm transition-all text-left">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{s.name}</p>
                    {s.phone && <p className="text-xs text-zinc-400">{s.phone}</p>}
                  </div>
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                    <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          )}
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
              <h2 className="font-semibold text-zinc-900 dark:text-white">Modifier l&apos;acte</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Nom <span className="text-red-500">*</span></label>
                <input {...field("name")} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Catégorie</label>
                <select {...field("category")} className={inputCls}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Prix (MAD)</label>
                  <input type="number" step="0.01" min="0" {...field("price")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Durée (min)</label>
                  <input type="number" min="0" {...field("duration_minutes")} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Description</label>
                <textarea {...field("description")} rows={3} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes</label>
                <textarea {...field("notes")} rows={2} className={`${inputCls} resize-none`} />
              </div>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="ms-auto flex items-center gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                  {saving ? "Enregistrement…" : "Enregistrer"}
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
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Supprimer cet acte ?</h2>
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
