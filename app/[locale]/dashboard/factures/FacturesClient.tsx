"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { FactureWithPatient, FactureStatus, FactureItem } from "@/types/database";
import { DR } from "@/components/DetailRow";
import { useAppContext } from "@/components/AppContext";

interface Props {
  initialFactures: FactureWithPatient[];
  userId: string;
}

const emptyForm = {
  patient_id: "",
  status: "en_attente" as FactureStatus,
  total_price: "",
  deposit_paid: "0",
  notes: "",
};

const STATUS_STYLE: Record<string, string> = {
  en_attente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  en_cours:   "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  payee:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  annulee:    "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const STATUSES: FactureStatus[] = ["en_attente", "en_cours", "payee", "annulee"];

const STATUS_LABEL: Record<string, string> = {
  en_attente: "En attente",
  en_cours:   "En cours",
  payee:      "Payée",
  annulee:    "Annulée",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function FacturesClient({ initialFactures, userId }: Props) {
  const t = useTranslations("factures");
  const supabase = createClient();
  const searchParams = useSearchParams();
  const { shopName, shopAddress, shopPhone, logoUrl } = useAppContext();

  const [factures, setFactures] = useState<FactureWithPatient[]>(initialFactures);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFacture, setEditingFacture] = useState<FactureWithPatient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FactureWithPatient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<FactureWithPatient | null>(null);
  const [items, setItems] = useState<FactureItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    const found = factures.find((f) => f.id === id);
    if (found) openDetail(found);
  }, [searchParams]);

  async function openDetail(f: FactureWithPatient) {
    setDetail(f);
    setItemsLoading(true);
    setItems([]);
    const { data } = await supabase
      .from("facture_items")
      .select("*")
      .eq("facture_id", f.id);
    setItems((data ?? []) as FactureItem[]);
    setItemsLoading(false);
  }

  async function handleStatusChange(newStatus: FactureStatus) {
    if (!detail) return;
    const { data, error: err } = await supabase
      .from("factures")
      .update({ status: newStatus })
      .eq("id", detail.id)
      .select("*, patients(first_name, last_name, phone)")
      .single();
    if (err) return;
    const updated = data as FactureWithPatient;
    setFactures((fs) => fs.map((f) => (f.id === updated.id ? updated : f)));
    setDetail(updated);
  }

  const filtered = useMemo(() =>
    factures.filter((f) => {
      const name = `${f.patients.first_name} ${f.patients.last_name}`.toLowerCase();
      return name.includes(search.toLowerCase());
    }),
    [factures, search]
  );

  function openAdd() {
    setEditingFacture(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(f: FactureWithPatient) {
    setEditingFacture(f);
    setForm({
      patient_id: f.patient_id,
      status: f.status,
      total_price: String(f.total_price),
      deposit_paid: String(f.deposit_paid),
      notes: f.notes ?? "",
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
    if (!form.total_price) {
      setError(t("form.requiredError"));
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      patient_id: form.patient_id.trim(),
      status: form.status,
      total_price: parseFloat(form.total_price),
      deposit_paid: parseFloat(form.deposit_paid) || 0,
      notes: form.notes.trim() || null,
    };

    if (editingFacture) {
      const { data, error: err } = await supabase
        .from("factures")
        .update(payload)
        .eq("id", editingFacture.id)
        .select("*, patients(first_name, last_name, phone)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setFactures((fs) => fs.map((f) => (f.id === data.id ? (data as FactureWithPatient) : f)));
    } else {
      const { data, error: err } = await supabase
        .from("factures")
        .insert({ ...payload, user_id: userId })
        .select("*, patients(first_name, last_name, phone)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setFactures((fs) => [data as FactureWithPatient, ...fs]);
    }

    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("factures").delete().eq("id", deleteTarget.id);
    setFactures((fs) => fs.filter((f) => f.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function exportFacturePdf(facture: FactureWithPatient) {
    const { exportFacturePdf: exportFn } = await import("@/utils/pdf-export");
    exportFn({
      factureId:     facture.id,
      patientName:   facture.patients ? `${facture.patients.first_name} ${facture.patients.last_name}` : "—",
      patientPhone:  facture.patients?.phone ?? null,
      patientAddress: null,
      createdAt:     facture.created_at,
      statusLabel:   STATUS_LABEL[facture.status] ?? facture.status,
      items:         items.map((i) => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })),
      totalPrice:    facture.total_price,
      depositPaid:   facture.deposit_paid,
      notes:         facture.notes,
      shopName,
      shopAddress,
      shopPhone,
      logoUrl,
    });
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
          + {t("newFacture")}
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
            <span className="text-4xl mb-3">{search ? "🔍" : "🧾"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {search ? t("noResults") : t("noFactures")}
            </p>
            {!search && (
              <button
                onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
              >
                + {t("newFacture")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.patient")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.status")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.total")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.remaining")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.date")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => openDetail(f)}
                    className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">
                      {f.patients.first_name} {f.patients.last_name}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[f.status] ?? STATUS_STYLE.en_attente}`}>
                        {t(`status.${f.status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{f.total_price.toFixed(2)} MAD</td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">
                      {(f.total_price - f.deposit_paid).toFixed(2)} MAD
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400">{fmtDate(f.created_at)}</td>
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
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 dark:text-teal-400 text-lg font-bold">
                  🧾
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">
                    {detail.patients.first_name} {detail.patients.last_name}
                  </h2>
                  <p className="text-xs text-zinc-400">{fmtDate(detail.created_at)}</p>
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {/* Inline status change */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 w-24 shrink-0">{t("columns.status")}</span>
                <select
                  value={detail.status}
                  onChange={(e) => handleStatusChange(e.target.value as FactureStatus)}
                  className={`flex-1 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 ${STATUS_STYLE[detail.status] ?? ""}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`status.${s}`)}</option>
                  ))}
                </select>
              </div>

              <DR label={t("columns.total")} value={`${detail.total_price.toFixed(2)} MAD`} />
              <DR label={t("form.deposit")} value={`${detail.deposit_paid.toFixed(2)} MAD`} />
              <DR label={t("columns.remaining")} value={`${(detail.total_price - detail.deposit_paid).toFixed(2)} MAD`} />
              <DR label={t("form.notes")} value={detail.notes} />

              {/* Items list */}
              <div className="pt-2">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Lignes de facture</p>
                {itemsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <svg className="w-6 h-6 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-4">Aucune ligne</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{item.description}</p>
                          <p className="text-xs text-zinc-400">Qté: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ms-3 shrink-0">
                          {(item.quantity * item.unit_price).toFixed(2)} MAD
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
              <button
                onClick={() => { setDeleteTarget(detail); setDetail(null); }}
                className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
              >
                Supprimer
              </button>
              <div className="ms-auto flex items-center gap-2">
                <button
                  onClick={() => exportFacturePdf(detail)}
                  className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors"
                >
                  🖨️ PDF
                </button>
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
                {editingFacture ? t("form.editTitle") : t("form.addTitle")}
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
                <input type="text" {...field("patient_id")} placeholder="UUID du patient" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.status")}
                </label>
                <select {...field("status")} className={inputCls}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`status.${s}`)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.total")} <span className="text-red-500">*</span>
                  </label>
                  <input type="number" min="0" step="0.01" {...field("total_price")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.deposit")}
                  </label>
                  <input type="number" min="0" step="0.01" {...field("deposit_paid")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.notes")}
                </label>
                <textarea {...field("notes")} rows={3} className={`${inputCls} resize-none`} />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editingFacture && (
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(editingFacture); setModalOpen(false); }}
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
