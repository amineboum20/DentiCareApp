"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { FactureWithPatient, FactureItem, Patient } from "@/types/database";
import { DR } from "@/components/DetailRow";
import { useAppContext } from "@/components/AppContext";

interface Props {
  facture: FactureWithPatient;
  patients: Pick<Patient, "id" | "first_name" | "last_name">[];
  locale: string;
}

type FactureStatus = "en_attente" | "en_cours" | "payee" | "annulee";

const FACTURE_STATUS_STYLE: Record<string, string> = {
  en_attente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  en_cours:   "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  payee:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  annulee:    "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const FACTURE_STATUSES: FactureStatus[] = ["en_attente", "en_cours", "payee", "annulee"];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

const emptyForm = {
  patient_id: "", status: "en_attente" as FactureStatus,
  total_price: "", deposit_paid: "", notes: "",
};

export default function FactureDetailClient({ facture: initialFacture, patients, locale }: Props) {
  const t = useTranslations("factures");
  const tc = useTranslations("common");
  const tfac = useTranslations("factureStatus");
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { shopName, shopAddress, shopPhone, logoUrl, currentUserId } = useAppContext();

  const [facture, setFacture] = useState<FactureWithPatient>(initialFacture);
  const [items, setItems] = useState<FactureItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Correction: a draft (en_attente) facture can have its lines edited in place;
  // once en_cours/payée it is locked — correct it by cancel + reissue instead.
  const [editLines, setEditLines] = useState(false);
  const [lineDraft, setLineDraft] = useState<{ description: string; quantity: string; unit_price: string }[]>([]);
  const [savingLines, setSavingLines] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  const isDraft = facture.status === "en_attente";

  const patientData = facture.patients as { first_name: string; last_name: string } | null;
  const patientName = patientData ? `${patientData.first_name} ${patientData.last_name}` : null;

  useEffect(() => {
    supabase.from("facture_items").select("*").eq("facture_id", facture.id).order("id").then(({ data }) => {
      setItems((data ?? []) as FactureItem[]);
      setItemsLoading(false);
    });
  }, [facture.id, supabase]);

  async function handleStatusChange(newStatus: string) {
    await supabase.from("factures").update({ status: newStatus }).eq("id", facture.id);
    setFacture(f => ({ ...f, status: newStatus as FactureStatus }));
  }

  function openEdit() {
    setForm({
      patient_id: facture.patient_id,
      status: facture.status as FactureStatus,
      total_price: String(facture.total_price),
      deposit_paid: String(facture.deposit_paid),
      notes: facture.notes ?? "",
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
    if (!form.patient_id) { setFormError(t("form.patientRequired")); return; }
    setSaving(true); setFormError("");
    const payload = {
      patient_id: form.patient_id,
      status: form.status,
      total_price: parseFloat(form.total_price) || 0,
      deposit_paid: parseFloat(form.deposit_paid) || 0,
      notes: form.notes.trim() || null,
    };
    const { data, error } = await supabase.from("factures").update(payload).eq("id", facture.id).select("*, patients(first_name, last_name)").single();
    if (error) { setFormError(error.message); setSaving(false); return; }
    setFacture(data as FactureWithPatient);
    setSaving(false); setModalOpen(false);
  }

  // A facture is never deleted — it is cancelled (status → "annulee"). The row is
  // kept for the audit trail and drops out of every total; reactivate it via the
  // status buttons above.
  async function handleCancel() {
    setDeleting(true);
    const { error } = await supabase.from("factures").update({ status: "annulee" }).eq("id", facture.id);
    setDeleting(false);
    if (error) return;
    setFacture((f) => ({ ...f, status: "annulee" }));
    setDeleteOpen(false);
  }

  function startEditLines() {
    setLineDraft(items.map((i) => ({ description: i.description, quantity: String(i.quantity), unit_price: String(i.unit_price) })));
    if (items.length === 0) setLineDraft([{ description: "", quantity: "1", unit_price: "" }]);
    setEditLines(true);
  }
  async function saveLines() {
    const valid = lineDraft.filter((l) => l.description.trim() && parseFloat(l.unit_price) >= 0);
    if (valid.length === 0) { setFormError(t("detail.errNoLine")); return; }
    setSavingLines(true); setFormError("");
    const rows = valid.map((l) => ({ facture_id: facture.id, description: l.description.trim(), quantity: parseInt(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0, acte_id: null }));
    await supabase.from("facture_items").delete().eq("facture_id", facture.id);
    const { data: inserted } = await supabase.from("facture_items").insert(rows).select("*");
    const newTotal = rows.reduce((s, r) => s + r.quantity * r.unit_price, 0);
    await supabase.from("factures").update({ total_price: newTotal }).eq("id", facture.id);
    setItems((inserted ?? []) as FactureItem[]);
    setFacture((f) => ({ ...f, total_price: newTotal }));
    setSavingLines(false); setEditLines(false);
  }
  // Correct a locked facture: optionally cancel the original, then clone its
  // lines into a fresh en_attente draft you can edit.
  async function reissue(cancelOriginal: boolean) {
    setReissuing(true);
    if (cancelOriginal) {
      await supabase.from("factures").update({ status: "annulee" }).eq("id", facture.id);
    }
    const { data: fac, error } = await supabase.from("factures").insert({
      practice_id: facture.practice_id, created_by: currentUserId, user_id: currentUserId,
      patient_id: facture.patient_id, dossier_id: facture.dossier_id, appointment_id: facture.appointment_id,
      type: facture.type, status: "en_attente", total_price: facture.total_price, deposit_paid: 0,
      notes: facture.notes,
    }).select("id").single();
    if (error || !fac) { setReissuing(false); return; }
    if (items.length > 0) {
      await supabase.from("facture_items").insert(items.map((i) => ({ facture_id: (fac as { id: string }).id, description: i.description, quantity: i.quantity, unit_price: i.unit_price, acte_id: i.acte_id ?? null })));
    }
    router.push(`/${locale}/dashboard/factures/${(fac as { id: string }).id}`);
  }

  async function exportPdf() {
    const { exportFacturePdf } = await import("@/utils/pdf-export");
    // When the facture belongs to a dossier, deposit is tracked via the shared
    // acomptes ledger (deposit_paid stays 0), so mirror the dossier hub figure.
    let depositPaid = facture.deposit_paid;
    if (facture.dossier_id) {
      const { data: acs } = await supabase.from("acomptes").select("montant").eq("dossier_id", facture.dossier_id);
      const paid = (acs ?? []).reduce((s, a) => s + Number(a.montant), 0);
      depositPaid = Math.min(paid, Number(facture.total_price));
    }
    exportFacturePdf({
      factureId: facture.id,
      docType: facture.type,
      appointmentId: facture.appointment_id,
      patientName: patientName ?? "",
      patientPhone: null,
      patientAddress: null,
      createdAt: facture.created_at,
      statusLabel: tfac(facture.status),
      items: items.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })),
      totalPrice: facture.total_price,
      depositPaid,
      notes: facture.notes,
      shopName, shopAddress, shopPhone, logoUrl,
    });
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
          {tc("back")}
        </button>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl shrink-0">🧾</div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("detail.title")}</h1>
            {patientName && (
              <button
                onClick={() => router.push(`/${locale}/dashboard/patients/${facture.patient_id}`)}
                className="text-sm text-teal-600 dark:text-teal-400 hover:underline mt-0.5"
              >
                {patientName}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Info card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{t("detail.informations")}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FACTURE_STATUS_STYLE[facture.status] ?? ""}`}>
              {tfac(facture.status)}
            </span>
          </div>
          <div className="space-y-1">
            <DR label={t("detail.patient")} value={patientName} />
            <DR label={t("detail.date")} value={fmtDate(facture.created_at)} />
            <DR label={t("detail.total")} value={`${facture.total_price.toFixed(2)} MAD`} />
            <DR label={t("detail.depositPaid")} value={`${facture.deposit_paid.toFixed(2)} MAD`} />
            <DR label={t("detail.reste")} value={`${(facture.total_price - facture.deposit_paid).toFixed(2)} MAD`} />
            <DR label={t("detail.notes")} value={facture.notes} />
          </div>

          {/* Inline status change */}
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">{t("detail.changeStatus")}</label>
            <div className="flex flex-wrap gap-2">
              {FACTURE_STATUSES.map(s => (
                <button key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    facture.status === s
                      ? `${FACTURE_STATUS_STYLE[s]} border-transparent ring-2 ring-offset-1 ring-teal-400`
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}>
                  {tfac(s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              {t("detail.factureLines")}
              {!itemsLoading && (
                <span className="ml-2 text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{items.length}</span>
              )}
            </h2>
            {isDraft && !editLines && !itemsLoading && (
              <button onClick={startEditLines} className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 font-medium transition-colors">✏️ {t("detail.editLinesBtn")}</button>
            )}
          </div>
          {itemsLoading ? (
            <div className="flex justify-center py-6">
              <svg className="w-6 h-6 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : editLines ? (
            <div className="space-y-2">
              {lineDraft.map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder={t("detail.descriptionPlaceholder")} value={l.description} onChange={(e) => setLineDraft((xs) => xs.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className={`flex-1 ${inputCls}`} />
                  <input type="number" min="1" value={l.quantity} onChange={(e) => setLineDraft((xs) => xs.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} className="w-16 px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  <input type="number" min="0" step="0.01" value={l.unit_price} onChange={(e) => setLineDraft((xs) => xs.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} className="w-24 px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  <button type="button" onClick={() => setLineDraft((xs) => xs.length > 1 ? xs.filter((_, j) => j !== i) : xs)} className="text-zinc-300 hover:text-red-500 text-sm shrink-0">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => setLineDraft((xs) => [...xs, { description: "", quantity: "1", unit_price: "" }])} className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium">+ {t("detail.addLine")}</button>
              <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-500">{t("detail.totalLabel")}</span>
                <span className="text-base font-bold text-zinc-900 dark:text-white">{lineDraft.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0).toFixed(2)} MAD</span>
              </div>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <div className="flex items-center gap-3 justify-end pt-1">
                <button onClick={() => { setEditLines(false); setFormError(""); }} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">{tc("cancel")}</button>
                <button onClick={saveLines} disabled={savingLines} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{savingLines ? t("detail.savingLines") : t("detail.saveLines")}</button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">{t("detail.noLines")}</p>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.description}</p>
                    <p className="text-xs text-zinc-400">{t("detail.qtyLine", { q: item.quantity, p: item.unit_price.toFixed(2) })}</p>
                  </div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ms-4 shrink-0">
                    {(item.quantity * item.unit_price).toFixed(2)} MAD
                  </p>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <div className="text-right">
                  <p className="text-xs text-zinc-400">{t("detail.totalLabel")}</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-white">{facture.total_price.toFixed(2)} MAD</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 pb-8">
          {facture.status !== "annulee" && (
            <button onClick={() => setDeleteOpen(true)}
              className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
              {t("cancelDialog.confirm")}
            </button>
          )}
          {(facture.status === "en_cours" || facture.status === "payee") && (
            <button onClick={() => reissue(true)} disabled={reissuing}
              className="px-4 py-2 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm font-medium transition-colors disabled:opacity-60">
              {reissuing ? "…" : t("detail.correctBtn")}
            </button>
          )}
          {facture.status === "annulee" && (
            <button onClick={() => reissue(false)} disabled={reissuing}
              className="px-4 py-2 rounded-lg border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-sm font-medium transition-colors disabled:opacity-60">
              {reissuing ? "…" : t("detail.recreateBtn")}
            </button>
          )}
          <button onClick={exportPdf}
            className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors">
            🖨️ PDF
          </button>
          <div className="ms-auto">
            <button onClick={openEdit}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
              ✏️ {t("detail.edit")}
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.patient")} <span className="text-red-500">*</span></label>
                <select {...field("patient_id")} className={inputCls}>
                  <option value="">{t("detail.selectPatient")}</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.status")}</label>
                <select {...field("status")} className={inputCls}>
                  {FACTURE_STATUSES.map(s => <option key={s} value={s}>{tfac(s)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.totalPrice")}</label>
                  <input type="number" step="0.01" min="0" {...field("total_price")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.depositPaid")}</label>
                  <input type="number" step="0.01" min="0" {...field("deposit_paid")} className={inputCls} />
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
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("cancelDialog.title")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t("detail.cancelBody")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                {tc("back")}
              </button>
              <button onClick={handleCancel} disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                {deleting ? t("detail.cancelling") : t("cancelDialog.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
