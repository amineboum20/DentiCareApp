"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { FactureWithPatient, FactureStatus, Patient } from "@/types/database";
import { useAppContext } from "@/components/AppContext";

interface Props {
  initialFactures: FactureWithPatient[];
  patients: Pick<Patient, "id" | "first_name" | "last_name">[];
}

const emptyForm = {
  patient_id: "",
  status: "en_attente" as FactureStatus,
  total_price: "",
  deposit_paid: "0",
  notes: "",
  consultation_id: "",
};

const MOTIF_LABEL: Record<string, string> = {
  consultation: "Consultation", controle: "Contrôle", soin: "Soin", urgence: "Urgence", autre: "Autre",
};

const STATUS_STYLE: Record<string, string> = {
  en_attente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  en_cours:   "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  payee:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  annulee:    "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  en_attente: "En attente",
  en_cours:   "En cours",
  payee:      "Payée",
  annulee:    "Annulée",
};

const STATUSES: FactureStatus[] = ["en_attente", "en_cours", "payee", "annulee"];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function FacturesClient({ initialFactures, patients }: Props) {
  const t = useTranslations("factures");
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const { practiceId, currentUserId } = useAppContext();

  const [factures, setFactures] = useState<FactureWithPatient[]>(initialFactures);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFacture, setEditingFacture] = useState<FactureWithPatient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FactureWithPatient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [patientVisites, setPatientVisites] = useState<{ id: string; exam_date: string; motif: string; dossier_id: string | null }[]>([]);

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    router.push(`/${locale}/dashboard/factures/${id}`);
  }, [searchParams, locale, router]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const patientId = searchParams.get("patient_id") ?? "";
    setEditingFacture(null);
    setForm({ ...emptyForm, patient_id: patientId });
    setError("");
    setModalOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!form.patient_id || !modalOpen) { setPatientVisites([]); return; }
    supabase.from("consultations")
      .select("id, exam_date, motif, dossier_id")
      .eq("patient_id", form.patient_id)
      .order("exam_date", { ascending: false })
      .then(({ data }) => setPatientVisites((data ?? []) as { id: string; exam_date: string; motif: string; dossier_id: string | null }[]));
  }, [form.patient_id, modalOpen, supabase]);

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

    // A facture is generated for a visite: link the chosen consultation and
    // inherit its dossier so the invoice lands in the right case.
    const selectedVisite = patientVisites.find((v) => v.id === form.consultation_id);
    const payload = {
      patient_id: form.patient_id.trim(),
      status: form.status,
      total_price: parseFloat(form.total_price),
      deposit_paid: parseFloat(form.deposit_paid) || 0,
      notes: form.notes.trim() || null,
      consultation_id: form.consultation_id || null,
      dossier_id: selectedVisite?.dossier_id ?? null,
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
        .insert({ ...payload, practice_id: practiceId, created_by: currentUserId, user_id: currentUserId })
        .select("*, patients(first_name, last_name, phone)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setFactures((fs) => [data as FactureWithPatient, ...fs]);
    }

    setSaving(false);
    setModalOpen(false);
  }

  // A facture is never deleted — it is cancelled (status → "annulee"). The row is
  // kept for the audit trail and drops out of every total; it can be reactivated
  // by changing its status back.
  async function handleCancel() {
    if (!deleteTarget) return;
    const { data, error } = await supabase
      .from("factures")
      .update({ status: "annulee" })
      .eq("id", deleteTarget.id)
      .select("*, patients(first_name, last_name, phone)")
      .single();
    if (!error && data) {
      setFactures((fs) => fs.map((f) => (f.id === data.id ? (data as FactureWithPatient) : f)));
    }
    setDeleteTarget(null);
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
                    onClick={() => router.push(`/${locale}/dashboard/factures/${f.id}`)}
                    className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">
                      {f.patients.first_name} {f.patients.last_name}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[f.status] ?? STATUS_STYLE.en_attente}`}>
                        {STATUS_LABEL[f.status] ?? f.status}
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
                  Patient <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.patient_id}
                  onChange={(e) => setForm(f => ({ ...f, patient_id: e.target.value }))}
                  className={inputCls}
                  required
                >
                  <option value="">— Sélectionner un patient —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.status")}
                </label>
                <select {...field("status")} className={inputCls}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
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

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">🦷 Visite liée (optionnel)</label>
                <select value={form.consultation_id} onChange={(e) => setForm((f) => ({ ...f, consultation_id: e.target.value }))} className={inputCls} disabled={!form.patient_id}>
                  <option value="">— Aucune —</option>
                  {patientVisites.map((v) => (
                    <option key={v.id} value={v.id}>
                      {new Date(v.exam_date).toLocaleDateString("fr-FR")} — {MOTIF_LABEL[v.motif] ?? v.motif}
                    </option>
                  ))}
                </select>
                {form.patient_id && patientVisites.length === 0 && <p className="text-[11px] text-zinc-400 mt-1">Aucune visite pour ce patient.</p>}
                {!form.patient_id && <p className="text-[11px] text-zinc-400 mt-1">Sélectionnez d&apos;abord un patient.</p>}
                <p className="text-[11px] text-zinc-400 mt-1">La facture reprend le dossier de la visite choisie.</p>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editingFacture && editingFacture.status !== "annulee" && (
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(editingFacture); setModalOpen(false); }}
                  className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
                >
                  Annuler la facture
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
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Annuler cette facture ?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              La facture sera marquée « Annulée » et exclue des totaux. Elle reste conservée pour l&apos;historique — vous pourrez la réactiver en changeant son statut.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Retour
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                Annuler la facture
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
