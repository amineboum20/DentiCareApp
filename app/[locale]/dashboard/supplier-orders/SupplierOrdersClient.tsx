"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { useAppContext } from "@/components/AppContext";
import type { Supplier, SupplierOrder, SupplierOrderStatus } from "@/types/database";

interface Props {
  initialOrders: SupplierOrder[];
  suppliers: Supplier[];
}

const emptyForm = {
  supplier_id: "",
  status: "ordered" as SupplierOrderStatus,
  ordered_at: new Date().toISOString().split("T")[0],
  expected_at: "",
  total_cost: "",
  notes: "",
};

const STATUS_STYLE: Record<SupplierOrderStatus, string> = {
  ordered:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  partial:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  received:  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  cancelled: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function SupplierOrdersClient({ initialOrders, suppliers }: Props) {
  const t = useTranslations("supplierOrders");
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const { practiceId, currentUserId } = useAppContext();

  const [orders, setOrders] = useState<SupplierOrder[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierOrderStatus | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierOrder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    router.push(`/${locale}/dashboard/supplier-orders/${id}`);
  }, [searchParams]);

  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]));

  const filtered = orders.filter(o => {
    const sup = supplierMap[o.supplier_id];
    const matchSearch = !search || (sup?.name ?? "").toLowerCase().includes(search.toLowerCase()) || (o.notes ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const STATUSES: SupplierOrderStatus[] = ["ordered", "partial", "received", "cancelled"];

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, supplier_id: suppliers[0]?.id ?? "" });
    setError(""); setModalOpen(true);
  }

  function openEdit(o: SupplierOrder) {
    setEditing(o);
    setForm({
      supplier_id: o.supplier_id,
      status: o.status,
      ordered_at: o.ordered_at.split("T")[0],
      expected_at: o.expected_at ? o.expected_at.split("T")[0] : "",
      total_cost: o.total_cost != null ? String(o.total_cost) : "",
      notes: o.notes ?? "",
    });
    setError(""); setModalOpen(true);
  }

  async function handleSave() {
    if (!form.supplier_id) { setError(t("form.requiredError")); return; }
    setSaving(true); setError("");
    const payload = {
      supplier_id: form.supplier_id,
      status: form.status,
      ordered_at: form.ordered_at || new Date().toISOString(),
      expected_at: form.expected_at || null,
      total_cost: form.total_cost ? parseFloat(form.total_cost) : null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { data, error: err } = await supabase.from("supplier_orders").update({ ...payload, updated_by: currentUserId }).eq("id", editing.id).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      setOrders(prev => prev.map(o => o.id === data.id ? data as SupplierOrder : o));
    } else {
      const { data, error: err } = await supabase.from("supplier_orders").insert({ ...payload, practice_id: practiceId, created_by: currentUserId }).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      setOrders(prev => [data as SupplierOrder, ...prev]);
    }
    setSaving(false); setModalOpen(false); setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("supplier_orders").delete().eq("id", deleteTarget.id);
    setOrders(prev => prev.filter(o => o.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{orders.length} commande{orders.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openCreate} disabled={suppliers.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          + {t("newOrder")}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full max-w-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <div className="flex gap-1">
          <button onClick={() => setStatusFilter("")} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!statusFilter ? "bg-teal-600 text-white border-teal-600" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
            {t("allStatuses")}
          </button>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusFilter === s ? "bg-teal-600 text-white border-teal-600" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
              {t(`statuses.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {suppliers.length === 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300">Ajoutez d&apos;abord un fournisseur pour créer des commandes.</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">📋</span>
          <p className="text-zinc-500 dark:text-zinc-400">{search || statusFilter ? t("noResults") : t("noOrders")}</p>
          {!search && !statusFilter && <p className="text-sm text-zinc-400 mt-1">{t("noOrdersDesc")}</p>}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.supplier")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.status")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.date")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.total")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const sup = supplierMap[o.supplier_id];
                  return (
                    <tr key={o.id} onClick={() => router.push(`/${locale}/dashboard/supplier-orders/${o.id}`)}
                      className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">{sup?.name ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[o.status]}`}>
                          {t(`statuses.${o.status}`)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{fmtDate(o.ordered_at)}</td>
                      <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">
                        {o.total_cost != null ? `${o.total_cost.toFixed(2)} MAD` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                {editing ? t("form.editTitle") : t("form.addTitle")}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.supplier")} *</label>
                <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className={inputCls}>
                  <option value="">{t("form.selectSupplier")}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.status")}</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SupplierOrderStatus }))} className={inputCls}>
                  {STATUSES.map(s => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.orderedAt")}</label>
                  <input type="date" value={form.ordered_at} onChange={e => setForm(f => ({ ...f, ordered_at: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.expectedAt")}</label>
                  <input type="date" value={form.expected_at} onChange={e => setForm(f => ({ ...f, expected_at: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.totalCost")}</label>
                <input type="number" min="0" step="0.01" value={form.total_cost} onChange={e => setForm(f => ({ ...f, total_cost: e.target.value }))} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.notes")}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                {t("form.cancel")}
              </button>
              <button onClick={handleSave} disabled={saving} className="ms-auto px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                {saving ? t("form.saving") : t("form.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("deleteConfirm.title")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t("deleteConfirm.message")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                {t("deleteConfirm.cancel")}
              </button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
                {t("deleteConfirm.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
