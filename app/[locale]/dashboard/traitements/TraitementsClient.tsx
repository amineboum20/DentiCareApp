"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { TreatmentCategory } from "@/types/database";
import { useAppContext } from "@/components/AppContext";

type ActeLite = { id: string; name: string; price: number; category?: string };

type PackageLine = {
  id: string;
  acte_id: string;
  quantity: number;
  sort_order: number;
  actes: { id: string; name: string; price: number } | null;
};

type Package = {
  id: string;
  name: string;
  category: TreatmentCategory;
  description: string | null;
  notes: string | null;
  price_override: number | null;
  traitement_actes: PackageLine[];
};

interface Props {
  initialTraitements: Package[];
  actes: ActeLite[];
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

type Line = { acte_id: string; quantity: string };

const emptyForm = {
  name: "",
  category: "autre" as TreatmentCategory,
  description: "",
  notes: "",
  price_override: "",
};

function computedPrice(pkg: Package): number {
  if (pkg.price_override != null) return pkg.price_override;
  return pkg.traitement_actes.reduce((s, l) => s + (l.actes?.price ?? 0) * l.quantity, 0);
}

export default function TraitementsClient({ initialTraitements, actes }: Props) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const { practiceId, currentUserId } = useAppContext();

  const [packages, setPackages] = useState<Package[]>(initialTraitements);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const acteById = useMemo(() => Object.fromEntries(actes.map(a => [a.id, a])), [actes]);

  useEffect(() => {
    if (searchParams.get("new") === "1") openAdd();
  }, [searchParams]);

  const filtered = useMemo(() =>
    packages.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    ),
    [packages, search]
  );

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setLines([{ acte_id: actes[0]?.id ?? "", quantity: "1" }]);
    setError("");
    setModalOpen(true);
  }

  function openEdit(p: Package) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      description: p.description ?? "",
      notes: p.notes ?? "",
      price_override: p.price_override != null ? String(p.price_override) : "",
    });
    const sorted = [...p.traitement_actes].sort((a, b) => a.sort_order - b.sort_order);
    setLines(sorted.length
      ? sorted.map(l => ({ acte_id: l.acte_id, quantity: String(l.quantity) }))
      : [{ acte_id: actes[0]?.id ?? "", quantity: "1" }]);
    setError("");
    setModalOpen(true);
  }

  const formTotal = useMemo(() => {
    if (form.price_override) return parseFloat(form.price_override) || 0;
    return lines.reduce((s, l) => s + (acteById[l.acte_id]?.price ?? 0) * (parseInt(l.quantity) || 0), 0);
  }, [lines, form.price_override, acteById]);

  async function handleSave() {
    if (!form.name.trim()) { setError("Le nom est obligatoire."); return; }
    const validLines = lines.filter(l => l.acte_id && (parseInt(l.quantity) || 0) > 0);
    if (validLines.length === 0) { setError("Ajoutez au moins un acte au paquet."); return; }
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
      price_override: form.price_override ? parseFloat(form.price_override) : null,
    };

    let savedId: string;
    if (editing) {
      const { data, error: err } = await supabase
        .from("traitements").update({ ...payload, updated_by: currentUserId })
        .eq("id", editing.id).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      savedId = data.id;
    } else {
      const { data, error: err } = await supabase
        .from("traitements")
        .insert({ ...payload, practice_id: practiceId, user_id: currentUserId, created_by: currentUserId })
        .select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      savedId = data.id;
    }

    await supabase.from("traitement_actes").delete().eq("traitement_id", savedId);
    const { error: linesErr } = await supabase.from("traitement_actes").insert(
      validLines.map((l, i) => ({
        traitement_id: savedId,
        acte_id: l.acte_id,
        quantity: parseInt(l.quantity) || 1,
        sort_order: i,
      }))
    );
    if (linesErr) { setError(linesErr.message); setSaving(false); return; }

    // Rebuild the package object locally
    const rebuilt: Package = {
      id: savedId,
      name: payload.name,
      category: payload.category,
      description: payload.description,
      notes: payload.notes,
      price_override: payload.price_override,
      traitement_actes: validLines.map((l, i) => ({
        id: `${savedId}-${i}`,
        acte_id: l.acte_id,
        quantity: parseInt(l.quantity) || 1,
        sort_order: i,
        actes: acteById[l.acte_id]
          ? { id: l.acte_id, name: acteById[l.acte_id].name, price: acteById[l.acte_id].price }
          : null,
      })),
    };
    setPackages((ps) => editing ? ps.map(p => p.id === savedId ? rebuilt : p) : [rebuilt, ...ps]);
    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("traitements").delete().eq("id", deleteTarget.id);
    setPackages((ps) => ps.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Traitements</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Paquets réutilisables regroupant plusieurs actes</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
        >
          + Nouveau traitement
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Rechercher un traitement…"
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
              {search ? "Aucun résultat" : "Aucun traitement pour l'instant"}
            </p>
            {!search && actes.length === 0 && (
              <p className="text-xs text-zinc-400 mt-2">Créez d&apos;abord des actes, puis regroupez-les ici.</p>
            )}
            {!search && actes.length > 0 && (
              <button
                onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
              >
                + Nouveau traitement
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Traitement</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Catégorie</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Actes</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Prix</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => openEdit(p)}
                    className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">{p.name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[p.category] ?? CATEGORY_STYLE.autre}`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">
                      {p.traitement_actes.length} acte{p.traitement_actes.length > 1 ? "s" : ""}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-900 dark:text-white font-medium">
                      {computedPrice(p).toFixed(2)} MAD
                      {p.price_override != null && <span className="ml-1 text-[10px] text-zinc-400">(forfait)</span>}
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
                {editing ? "Modifier le traitement" : "Nouveau traitement"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Nom <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex. Pose de couronne" />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Catégorie</label>
                <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value as TreatmentCategory }))} className={inputCls}>
                  {CATEGORIES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Actes composition */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Actes du paquet <span className="text-red-500">*</span></label>
                {actes.length === 0 ? (
                  <p className="text-xs text-zinc-400">Aucun acte disponible. Créez des actes d&apos;abord.</p>
                ) : (
                  <div className="space-y-2">
                    {lines.map((l, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select
                          value={l.acte_id}
                          onChange={(e) => setLines(xs => xs.map((x, j) => j === i ? { ...x, acte_id: e.target.value } : x))}
                          className={`${inputCls} flex-1`}
                        >
                          {actes.map(a => <option key={a.id} value={a.id}>{a.name} — {a.price.toFixed(2)} MAD</option>)}
                        </select>
                        <input
                          type="number" min="1" value={l.quantity}
                          onChange={(e) => setLines(xs => xs.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))}
                          className="w-16 px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <button type="button" onClick={() => setLines(xs => xs.filter((_, j) => j !== i))}
                          className="text-zinc-400 hover:text-red-500 px-1.5 text-lg leading-none" aria-label="Retirer">×</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setLines(xs => [...xs, { acte_id: actes[0]?.id ?? "", quantity: "1" }])}
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium">+ Ajouter un acte</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Prix forfaitaire (MAD)</label>
                  <input type="number" min="0" step="0.01" value={form.price_override}
                    onChange={(e) => setForm(f => ({ ...f, price_override: e.target.value }))}
                    placeholder="auto" className={inputCls} />
                  <p className="text-[10px] text-zinc-400 mt-1">Vide = somme des actes</p>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Total</label>
                  <div className="px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-sm font-semibold">
                    {formTotal.toFixed(2)} MAD
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editing && (
                <button type="button" onClick={() => { setDeleteTarget(editing); setModalOpen(false); }}
                  className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                  Supprimer
                </button>
              )}
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
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Supprimer ce traitement ?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Le paquet sera supprimé. Les actes du catalogue ne sont pas affectés.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Annuler
              </button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
