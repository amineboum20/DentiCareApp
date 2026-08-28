"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { useAppContext } from "@/components/AppContext";
import type { Supplier } from "@/types/database";

interface Props {
  initialSuppliers: Supplier[];
}

const emptyForm = {
  name: "", contact_name: "", phone: "", email: "", address: "", notes: "",
};

export default function SuppliersClient({ initialSuppliers }: Props) {
  const t = useTranslations("suppliers");
  const supabase = createClient();
  const { practiceId, currentUserId } = useAppContext();

  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [treatmentCounts, setTreatmentCounts] = useState<Record<string, number>>({});
  const [supplierTreatments, setSupplierTreatments] = useState<Record<string, { id: string; name: string }[]>>({});
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Supplier | null>(null);

  useEffect(() => {
    if (suppliers.length === 0) return;
    supabase
      .from("treatment_suppliers")
      .select("supplier_id, traitements(id, name)")
      .in("supplier_id", suppliers.map(s => s.id))
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        const treats: Record<string, { id: string; name: string }[]> = {};
        (data ?? []).forEach((row: { supplier_id: string; traitements: { id: string; name: string } | { id: string; name: string }[] }) => {
          const tr = Array.isArray(row.traitements) ? row.traitements[0] : row.traitements;
          if (!tr) return;
          counts[row.supplier_id] = (counts[row.supplier_id] ?? 0) + 1;
          treats[row.supplier_id] = [...(treats[row.supplier_id] ?? []), tr];
        });
        setTreatmentCounts(counts);
        setSupplierTreatments(treats);
      });
  }, [suppliers]);

  const filtered = suppliers.filter(s =>
    `${s.name} ${s.contact_name ?? ""} ${s.email ?? ""} ${s.phone ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null); setForm(emptyForm); setError(""); setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ name: s.name, contact_name: s.contact_name ?? "", phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", notes: s.notes ?? "" });
    setError(""); setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError(t("form.requiredError")); return; }
    setSaving(true); setError("");
    const payload = {
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { data, error: err } = await supabase.from("suppliers").update(payload).eq("id", editing.id).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      setSuppliers(prev => prev.map(s => s.id === data.id ? data as Supplier : s));
    } else {
      const { data, error: err } = await supabase.from("suppliers").insert({ ...payload, practice_id: practiceId, created_by: currentUserId }).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      setSuppliers(prev => [data as Supplier, ...prev]);
    }
    setSaving(false); setModalOpen(false); setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("suppliers").delete().eq("id", deleteTarget.id);
    setSuppliers(prev => prev.filter(s => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";
  const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{suppliers.length} fournisseur{suppliers.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
          + {t("newSupplier")}
        </button>
      </div>

      <div className="mb-4">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full max-w-sm px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">🏭</span>
          <p className="text-zinc-500 dark:text-zinc-400">{search ? t("noResults") : t("noSuppliers")}</p>
          {!search && <p className="text-sm text-zinc-400 mt-1">{t("noSuppliersDesc")}</p>}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(s => {
            const count = treatmentCounts[s.id] ?? 0;
            const isOpen = detail?.id === s.id;
            return (
              <div key={s.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetail(isOpen ? null : s)}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏭</span>
                    <p className="font-semibold text-zinc-900 dark:text-white truncate">{s.name}</p>
                    {count > 0 && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-xs font-medium">
                        {count} traitement{count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {s.contact_name && <p className="text-sm text-zinc-500 mt-0.5 ms-7">{s.contact_name}</p>}
                  <div className="flex flex-wrap gap-3 mt-1.5 ms-7">
                    {s.phone && <span className="text-xs text-zinc-400">📞 {s.phone}</span>}
                    {s.email && <span className="text-xs text-zinc-400">✉️ {s.email}</span>}
                  </div>
                  {isOpen && (
                    <div className="mt-3 ms-7 space-y-2">
                      {s.address && <p className="text-sm text-zinc-600 dark:text-zinc-300">📍 {s.address}</p>}
                      {s.notes && <p className="text-sm text-zinc-400 italic">{s.notes}</p>}
                      {(supplierTreatments[s.id] ?? []).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">{t("treatmentsLinked")} :</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(supplierTreatments[s.id] ?? []).map(tr => (
                              <span key={tr.id} className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs">
                                {tr.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(s)} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                    Modifier
                  </button>
                  <button onClick={() => setDeleteTarget(s)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-5">
              {editing ? t("form.editTitle") : t("form.addTitle")}
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>{t("form.name")} *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex. Dentsply Sirona" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("form.contact")}</label>
                <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Nom du contact" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t("form.phone")}</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+212 6XX XXX XXX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("form.email")}</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@example.com" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t("form.address")}</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Adresse" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("form.notes")}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes…" className={inputCls + " resize-none"} />
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                {t("form.cancel")}
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                {saving ? t("form.saving") : editing ? t("form.editTitle") : t("form.addTitle")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-sm w-full">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">{t("deleteConfirm.title")}</h3>
            <p className="text-sm text-zinc-500 mb-6">{deleteTarget.name}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                {t("deleteConfirm.cancel")}
              </button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
                {t("deleteConfirm.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
