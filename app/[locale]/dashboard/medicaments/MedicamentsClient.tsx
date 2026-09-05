"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Medicament } from "@/types/database";
import { useAppContext } from "@/components/AppContext";

interface Props {
  initial: Medicament[];
}

const emptyForm = {
  name: "", form: "", default_posologie: "", default_duree: "", default_quantite: "", default_instructions: "", notes: "",
};

export default function MedicamentsClient({ initial }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1];
  const { practiceId, currentUserId } = useAppContext();

  const [meds, setMeds] = useState<Medicament[]>(initial);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medicament | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() =>
    meds.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())),
    [meds, search]);

  function openAdd() {
    setEditing(null); setForm(emptyForm); setError(""); setModalOpen(true);
  }
  function openEdit(m: Medicament) {
    setEditing(m);
    setForm({
      name: m.name, form: m.form ?? "", default_posologie: m.default_posologie ?? "",
      default_duree: m.default_duree ?? "", default_quantite: m.default_quantite ?? "",
      default_instructions: m.default_instructions ?? "", notes: m.notes ?? "",
    });
    setError(""); setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Le nom est requis."); return; }
    setSaving(true); setError("");
    const payload = {
      name: form.name.trim(), form: form.form.trim() || null,
      default_posologie: form.default_posologie.trim() || null,
      default_duree: form.default_duree.trim() || null,
      default_quantite: form.default_quantite.trim() || null,
      default_instructions: form.default_instructions.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { data, error: e } = await supabase.from("medicaments").update(payload).eq("id", editing.id).select("*").single();
      if (e) { setError(e.message); setSaving(false); return; }
      setMeds((xs) => xs.map((m) => m.id === (data as Medicament).id ? (data as Medicament) : m).sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      const { data, error: e } = await supabase.from("medicaments").insert({ ...payload, practice_id: practiceId, user_id: currentUserId, created_by: currentUserId }).select("*").single();
      if (e) { setError(e.message); setSaving(false); return; }
      setMeds((xs) => [...xs, data as Medicament].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setSaving(false); setModalOpen(false);
  }

  async function handleArchive() {
    if (!editing) return;
    await supabase.from("medicaments").update({ archived_at: new Date().toISOString() }).eq("id", editing.id);
    setMeds((xs) => xs.filter((m) => m.id !== editing.id));
    setModalOpen(false);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      <button onClick={() => router.push(`/${locale}/dashboard/ordonnances`)} className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors mb-4">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4" /></svg>
        Ordonnances
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Catalogue des médicaments</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">+ Nouveau médicament</button>
      </div>

      <div className="relative mb-5">
        <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
        <input type="text" placeholder="Rechercher un médicament…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-9 pe-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500" />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">{search ? "🔍" : "💊"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{search ? "Aucun résultat" : "Aucun médicament au catalogue"}</p>
            {!search && <button onClick={openAdd} className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium">+ Nouveau médicament</button>}
          </div>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
            {filtered.map((m) => (
              <div key={m.id} onClick={() => openEdit(m)} className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{m.name}{m.form ? <span className="text-zinc-400 font-normal"> · {m.form}</span> : null}</p>
                  {(m.default_posologie || m.default_duree || m.default_quantite) && (
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">
                      {[m.default_posologie, m.default_duree, m.default_quantite].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <span className="text-xs text-zinc-300 shrink-0 ms-2">Modifier →</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">{editing ? "Modifier le médicament" : "Nouveau médicament"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Nom <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex. Amoxicilline 500mg" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Forme</label>
                  <input value={form.form} onChange={(e) => setForm((f) => ({ ...f, form: e.target.value }))} placeholder="Comprimé, sirop…" className={inputCls} />
                </div>
              </div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide pt-1">Valeurs par défaut</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Posologie</label>
                  <input value={form.default_posologie} onChange={(e) => setForm((f) => ({ ...f, default_posologie: e.target.value }))} placeholder="1 cp x3/j" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Durée</label>
                  <input value={form.default_duree} onChange={(e) => setForm((f) => ({ ...f, default_duree: e.target.value }))} placeholder="7 jours" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Quantité</label>
                  <input value={form.default_quantite} onChange={(e) => setForm((f) => ({ ...f, default_quantite: e.target.value }))} placeholder="1 boîte" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Instructions</label>
                <input value={form.default_instructions} onChange={(e) => setForm((f) => ({ ...f, default_instructions: e.target.value }))} placeholder="Après les repas" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editing && (
                <button onClick={handleArchive} className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">Archiver</button>
              )}
              <div className="ms-auto flex items-center gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Annuler</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{saving ? "Enregistrement…" : "Enregistrer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
