"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Acte, TreatmentCategory, Supplier } from "@/types/database";
import { useAppContext } from "@/components/AppContext";

interface Props {
  initialActes: Acte[];
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

export default function ActesClient({ initialActes }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const { practiceId, currentUserId } = useAppContext();

  const [actes, setActes] = useState<Acte[]>(initialActes);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActe, setEditingActe] = useState<Acte | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Acte | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    router.push(`/${locale}/dashboard/actes/${id}`);
  }, [searchParams, locale, router]);

  useEffect(() => {
    if (searchParams.get("new") === "1") openAdd();
  }, [searchParams]);

  useEffect(() => {
    if (!practiceId) return;
    supabase.from("suppliers").select("*").eq("practice_id", practiceId).order("name")
      .then(({ data }) => setSuppliers((data ?? []) as Supplier[]));
  }, [practiceId, supabase]);

  const filtered = useMemo(() =>
    actes.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase())
    ),
    [actes, search]
  );

  function openAdd() {
    setEditingActe(null);
    setForm(emptyForm);
    setSelectedSuppliers([]);
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
      setError("Le nom et le prix sont obligatoires.");
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

    let savedId: string;

    if (editingActe) {
      const { data, error: err } = await supabase
        .from("actes")
        .update(payload)
        .eq("id", editingActe.id)
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setActes((as) => as.map((a) => (a.id === data.id ? (data as Acte) : a)));
      savedId = data.id;
    } else {
      const { data, error: err } = await supabase
        .from("actes")
        .insert({ ...payload, practice_id: practiceId, created_by: currentUserId, user_id: currentUserId })
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setActes((as) => [data as Acte, ...as]);
      savedId = data.id;
    }

    await supabase.from("treatment_suppliers").delete().eq("treatment_id", savedId);
    if (selectedSuppliers.length > 0) {
      await supabase.from("treatment_suppliers").insert(
        selectedSuppliers.map(sid => ({ treatment_id: savedId, supplier_id: sid }))
      );
    }

    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("actes").delete().eq("id", deleteTarget.id);
    setActes((as) => as.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Actes</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Actes facturables (radio, détartrage, extraction…)</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
        >
          + Nouvel acte
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Rechercher un acte…"
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
              {search ? "Aucun résultat" : "Aucun acte pour l'instant"}
            </p>
            {!search && (
              <button
                onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
              >
                + Nouvel acte
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Acte</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Catégorie</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Prix</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Durée</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`/${locale}/dashboard/actes/${a.id}`)}
                    className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">{a.name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[a.category] ?? CATEGORY_STYLE.autre}`}>
                        {a.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{a.price.toFixed(2)} MAD</td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">
                      {a.duration_minutes != null ? `${a.duration_minutes} min` : "—"}
                    </td>
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
                {editingActe ? "Modifier l'acte" : "Nouvel acte"}
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
                  Nom <span className="text-red-500">*</span>
                </label>
                <input type="text" {...field("name")} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Catégorie <span className="text-red-500">*</span>
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
                    Prix (MAD) <span className="text-red-500">*</span>
                  </label>
                  <input type="number" min="0" step="0.01" {...field("price")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Durée
                  </label>
                  <input type="number" min="0" step="1" {...field("duration_minutes")} placeholder="minutes" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Description
                </label>
                <textarea {...field("description")} rows={2} className={`${inputCls} resize-none`} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Notes
                </label>
                <textarea {...field("notes")} rows={2} className={`${inputCls} resize-none`} />
              </div>

              {suppliers.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Fournisseurs
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {suppliers.map(s => {
                      const sel = selectedSuppliers.includes(s.id);
                      return (
                        <button key={s.id} type="button"
                          onClick={() => setSelectedSuppliers(prev => sel ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            sel
                              ? "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700"
                              : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-teal-300"
                          }`}
                        >
                          🏭 {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editingActe && (
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(editingActe); setModalOpen(false); }}
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
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
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
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Supprimer cet acte ?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
