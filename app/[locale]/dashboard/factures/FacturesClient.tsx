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
  appointment_id: "",
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
  const supabase = createClient();
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
  const [patientAppointments, setPatientAppointments] = useState<{id: string; title: string; scheduled_at: string}[]>([]);
  const [newApptMode, setNewApptMode] = useState(false);
  const [newApptTitle, setNewApptTitle] = useState("");
  const [newApptDate, setNewApptDate] = useState("");
  const [newApptTime, setNewApptTime] = useState("");

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    router.push(`/${locale}/dashboard/factures/${id}`);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const patientId = searchParams.get("patient_id") ?? "";
    setEditingFacture(null);
    setForm({ ...emptyForm, patient_id: patientId });
    setError("");
    setModalOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!form.patient_id || !modalOpen) { setPatientAppointments([]); return; }
    const now = new Date().toISOString();
    supabase.from("appointments")
      .select("id, title, scheduled_at")
      .eq("patient_id", form.patient_id)
      .eq("status", "planifie")
      .gte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .then(({ data }) => setPatientAppointments((data ?? []) as {id: string; title: string; scheduled_at: string}[]));
  }, [form.patient_id, modalOpen]);

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

    let appointmentId = form.appointment_id || null;
    if (newApptMode && newApptDate && newApptTime) {
      const { data: apptData } = await supabase.from("appointments").insert({
        practice_id: practiceId,
        created_by: currentUserId,
        user_id: currentUserId,
        patient_id: form.patient_id || null,
        title: newApptTitle.trim() || "Soins dentaires",
        type: "soin",
        status: "planifie",
        scheduled_at: `${newApptDate}T${newApptTime}:00`,
        notes: null,
      }).select().single();
      if (apptData) appointmentId = apptData.id;
    }

    const payload = {
      patient_id: form.patient_id.trim(),
      status: form.status,
      total_price: parseFloat(form.total_price),
      deposit_paid: parseFloat(form.deposit_paid) || 0,
      notes: form.notes.trim() || null,
      appointment_id: appointmentId,
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

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("factures").delete().eq("id", deleteTarget.id);
    setFactures((fs) => fs.filter((f) => f.id !== deleteTarget.id));
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
                  {t("form.patientId")} <span className="text-red-500">*</span>
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

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">📅 RDV lié (optionnel)</label>
                {!newApptMode ? (
                  <div className="flex gap-1">
                    <select value={form.appointment_id} onChange={(e) => setForm((f) => ({ ...f, appointment_id: e.target.value }))}
                      className={`flex-1 ${inputCls}`}>
                      <option value="">— Aucun —</option>
                      {patientAppointments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {new Date(a.scheduled_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} — {a.title}
                        </option>
                      ))}
                    </select>
                    <button type="button"
                      onClick={() => { setNewApptMode(true); setNewApptTitle("Soins dentaires"); }}
                      disabled={!form.patient_id}
                      title="Créer un RDV"
                      className="px-2.5 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100 text-sm font-bold transition-colors disabled:opacity-40 shrink-0">
                      +
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 p-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/10">
                    <input value={newApptTitle} onChange={(e) => setNewApptTitle(e.target.value)}
                      placeholder="Titre du RDV"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={newApptDate} onChange={(e) => setNewApptDate(e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500" />
                      <input type="time" value={newApptTime} onChange={(e) => setNewApptTime(e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500" />
                    </div>
                    <button type="button" onClick={() => { setNewApptMode(false); setNewApptDate(""); setNewApptTime(""); }}
                      className="text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors">
                      ✕ Annuler
                    </button>
                  </div>
                )}
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
