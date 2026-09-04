"use client";

import { useState, useEffect } from "react";
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

const FACTURE_STATUS_LABEL: Record<string, string> = {
  en_attente: "En attente",
  en_cours:   "En cours",
  payee:      "Payée",
  annulee:    "Annulée",
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
  const supabase = createClient();
  const router = useRouter();
  const { shopName, shopAddress, shopPhone, logoUrl } = useAppContext();

  const [facture, setFacture] = useState<FactureWithPatient>(initialFacture);
  const [items, setItems] = useState<FactureItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patientData = facture.patients as { first_name: string; last_name: string } | null;
  const patientName = patientData ? `${patientData.first_name} ${patientData.last_name}` : null;

  useEffect(() => {
    supabase.from("facture_items").select("*").eq("facture_id", facture.id).order("id").then(({ data }) => {
      setItems((data ?? []) as FactureItem[]);
      setItemsLoading(false);
    });
  }, [facture.id]);

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
    if (!form.patient_id) { setFormError("Le patient est requis."); return; }
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

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("factures").delete().eq("id", facture.id);
    router.push(`/${locale}/dashboard/factures`);
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
      statusLabel: FACTURE_STATUS_LABEL[facture.status] ?? facture.status,
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
          Retour
        </button>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl shrink-0">🧾</div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Facture</h1>
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
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Informations</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FACTURE_STATUS_STYLE[facture.status] ?? ""}`}>
              {FACTURE_STATUS_LABEL[facture.status] ?? facture.status}
            </span>
          </div>
          <div className="space-y-1">
            <DR label="Patient" value={patientName} />
            <DR label="Date" value={fmtDate(facture.created_at)} />
            <DR label="Total" value={`${facture.total_price.toFixed(2)} MAD`} />
            <DR label="Acompte versé" value={`${facture.deposit_paid.toFixed(2)} MAD`} />
            <DR label="Reste à payer" value={`${(facture.total_price - facture.deposit_paid).toFixed(2)} MAD`} />
            <DR label="Notes" value={facture.notes} />
          </div>

          {/* Inline status change */}
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Changer le statut</label>
            <div className="flex flex-wrap gap-2">
              {FACTURE_STATUSES.map(s => (
                <button key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    facture.status === s
                      ? `${FACTURE_STATUS_STYLE[s]} border-transparent ring-2 ring-offset-1 ring-teal-400`
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}>
                  {FACTURE_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
            Lignes de facture
            {!itemsLoading && (
              <span className="ml-2 text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{items.length}</span>
            )}
          </h2>
          {itemsLoading ? (
            <div className="flex justify-center py-6">
              <svg className="w-6 h-6 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">Aucune ligne de facture</p>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{item.description}</p>
                    <p className="text-xs text-zinc-400">Qté {item.quantity} × {item.unit_price.toFixed(2)} MAD</p>
                  </div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ms-4 shrink-0">
                    {(item.quantity * item.unit_price).toFixed(2)} MAD
                  </p>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <div className="text-right">
                  <p className="text-xs text-zinc-400">Total</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-white">{facture.total_price.toFixed(2)} MAD</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 pb-8">
          <button onClick={() => setDeleteOpen(true)}
            className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
            Supprimer
          </button>
          <button onClick={exportPdf}
            className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors">
            🖨️ PDF
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.patient")} <span className="text-red-500">*</span></label>
                <select {...field("patient_id")} className={inputCls}>
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.status")}</label>
                <select {...field("status")} className={inputCls}>
                  {FACTURE_STATUSES.map(s => <option key={s} value={s}>{FACTURE_STATUS_LABEL[s]}</option>)}
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
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Supprimer cette facture ?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Cette action est irréversible. Les lignes de facture seront également supprimées.</p>
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
