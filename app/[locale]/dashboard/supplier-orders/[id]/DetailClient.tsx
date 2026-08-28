"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { SupplierOrder, Supplier } from "@/types/database";
import { DR } from "@/components/DetailRow";

interface Props {
  order: SupplierOrder;
  suppliers: Supplier[];
  locale: string;
}

type SupplierOrderStatus = "en_attente" | "commande" | "recu" | "annule";

const STATUS_STYLE: Record<string, string> = {
  en_attente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  commande:   "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  recu:       "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  annule:     "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  en_attente: "En attente",
  commande:   "Commandé",
  recu:       "Reçu",
  annule:     "Annulé",
};

const STATUSES: SupplierOrderStatus[] = ["en_attente", "commande", "recu", "annule"];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

const emptyForm = {
  supplier_id: "", status: "en_attente" as SupplierOrderStatus,
  ordered_at: "", expected_at: "", received_at: "",
  total_cost: "", notes: "",
};

export default function SupplierOrderDetailClient({ order: initialOrder, suppliers, locale }: Props) {
  const t = useTranslations("supplierOrders");
  const supabase = createClient();
  const router = useRouter();

  const [order, setOrder] = useState<SupplierOrder>(initialOrder);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const supplierName = suppliers.find(s => s.id === order.supplier_id)?.name ?? null;

  function openEdit() {
    setForm({
      supplier_id: order.supplier_id,
      status: order.status as SupplierOrderStatus,
      ordered_at: order.ordered_at ? order.ordered_at.slice(0, 10) : "",
      expected_at: order.expected_at ? order.expected_at.slice(0, 10) : "",
      received_at: order.received_at ? order.received_at.slice(0, 10) : "",
      total_cost: String(order.total_cost ?? ""),
      notes: order.notes ?? "",
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
    if (!form.supplier_id) { setFormError("Le fournisseur est requis."); return; }
    setSaving(true); setFormError("");
    const payload = {
      supplier_id: form.supplier_id,
      status: form.status,
      ordered_at: form.ordered_at || null,
      expected_at: form.expected_at || null,
      received_at: form.received_at || null,
      total_cost: form.total_cost ? parseFloat(form.total_cost) : null,
      notes: form.notes.trim() || null,
    };
    const { data, error } = await supabase.from("supplier_orders").update(payload).eq("id", order.id).select().single();
    if (error) { setFormError(error.message); setSaving(false); return; }
    setOrder(data as SupplierOrder);
    setSaving(false); setModalOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("supplier_orders").delete().eq("id", order.id);
    router.push(`/${locale}/dashboard/supplier-orders`);
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
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl shrink-0">📦</div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Commande fournisseur</h1>
            {supplierName && (
              <button
                onClick={() => router.push(`/${locale}/dashboard/suppliers/${order.supplier_id}`)}
                className="text-sm text-teal-600 dark:text-teal-400 hover:underline mt-0.5"
              >
                {supplierName}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Informations</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[order.status] ?? ""}`}>
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>
          <div className="space-y-1">
            <DR label="Fournisseur" value={supplierName} />
            <DR label="Date de commande" value={fmtDate(order.ordered_at)} />
            <DR label="Livraison prévue" value={fmtDate(order.expected_at)} />
            <DR label="Date de réception" value={fmtDate(order.received_at)} />
            <DR label="Coût total" value={order.total_cost != null ? `${Number(order.total_cost).toFixed(2)} MAD` : null} />
            <DR label="Notes" value={order.notes} />
          </div>

          {/* Inline status change */}
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Changer le statut</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <button key={s}
                  onClick={async () => {
                    await supabase.from("supplier_orders").update({ status: s }).eq("id", order.id);
                    setOrder(o => ({ ...o, status: s }));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    order.status === s
                      ? `${STATUS_STYLE[s]} border-transparent ring-2 ring-offset-1 ring-teal-400`
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.supplier")} <span className="text-red-500">*</span></label>
                <select {...field("supplier_id")} className={inputCls}>
                  <option value="">Sélectionner un fournisseur</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.status")}</label>
                <select {...field("status")} className={inputCls}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.orderedAt")}</label>
                  <input type="date" {...field("ordered_at")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.expectedAt")}</label>
                  <input type="date" {...field("expected_at")} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.receivedAt")}</label>
                  <input type="date" {...field("received_at")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.totalCost")}</label>
                  <input type="number" step="0.01" min="0" {...field("total_cost")} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.notes")}</label>
                <textarea {...field("notes")} rows={3} className={`${inputCls} resize-none`} />
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
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Supprimer cette commande ?</h2>
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
