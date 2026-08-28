"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { AppointmentWithPatient, Patient } from "@/types/database";
import { DR } from "@/components/DetailRow";

interface Props {
  appointment: AppointmentWithPatient;
  patients: Pick<Patient, "id" | "first_name" | "last_name">[];
  locale: string;
}

type AppointmentStatus = "planifie" | "confirme" | "annule" | "complete";
type AppointmentType = "premiere_visite" | "controle" | "soin" | "urgence" | "autre";

const STATUS_STYLE: Record<string, string> = {
  planifie: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  confirme: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  annule:   "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  complete: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const STATUS_LABEL: Record<string, string> = {
  planifie: "Planifié",
  confirme: "Confirmé",
  annule:   "Annulé",
  complete: "Complété",
};

const STATUSES: AppointmentStatus[] = ["planifie", "confirme", "annule", "complete"];

const TYPES: AppointmentType[] = ["premiere_visite", "controle", "soin", "urgence", "autre"];

const TYPE_LABEL: Record<string, string> = {
  premiere_visite: "Première visite",
  controle: "Contrôle",
  soin: "Soin",
  urgence: "Urgence",
  autre: "Autre",
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const emptyForm = {
  patient_id: "", title: "",
  type: "controle" as AppointmentType,
  status: "planifie" as AppointmentStatus,
  scheduled_at: "", duration_minutes: "", notes: "",
};

export default function AppointmentDetailClient({ appointment: initialAppointment, patients, locale }: Props) {
  const t = useTranslations("appointments");
  const supabase = createClient();
  const router = useRouter();

  const [appointment, setAppointment] = useState<AppointmentWithPatient>(initialAppointment);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patientData = appointment.patients as { first_name: string; last_name: string } | null;
  const patientName = patientData ? `${patientData.first_name} ${patientData.last_name}` : null;

  async function handleStatusChange(newStatus: AppointmentStatus) {
    await supabase.from("appointments").update({ status: newStatus }).eq("id", appointment.id);
    setAppointment(a => ({ ...a, status: newStatus }));
  }

  function openEdit() {
    const localDt = appointment.scheduled_at
      ? new Date(appointment.scheduled_at).toISOString().slice(0, 16)
      : "";
    setForm({
      patient_id: appointment.patient_id,
      title: appointment.title,
      type: appointment.type as AppointmentType,
      status: appointment.status as AppointmentStatus,
      scheduled_at: localDt,
      duration_minutes: String(appointment.duration_minutes ?? ""),
      notes: appointment.notes ?? "",
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
    if (!form.patient_id || !form.title.trim() || !form.scheduled_at) {
      setFormError("Le patient, le titre et la date sont requis.");
      return;
    }
    setSaving(true); setFormError("");
    const payload = {
      patient_id: form.patient_id,
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      notes: form.notes.trim() || null,
    };
    const { data, error } = await supabase.from("appointments").update(payload).eq("id", appointment.id).select("*, patients(first_name, last_name)").single();
    if (error) { setFormError(error.message); setSaving(false); return; }
    setAppointment(data as AppointmentWithPatient);
    setSaving(false); setModalOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("appointments").delete().eq("id", appointment.id);
    router.push(`/${locale}/dashboard/appointments`);
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
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl shrink-0">📅</div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{appointment.title}</h1>
            {patientName && (
              <button
                onClick={() => router.push(`/${locale}/dashboard/patients/${appointment.patient_id}`)}
                className="text-sm text-teal-600 dark:text-teal-400 hover:underline mt-0.5"
              >
                {patientName}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Informations</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[appointment.status] ?? ""}`}>
              {STATUS_LABEL[appointment.status] ?? appointment.status}
            </span>
          </div>
          <div className="space-y-1">
            <DR label="Patient" value={patientName} />
            <DR label="Type" value={TYPE_LABEL[appointment.type] ?? appointment.type} />
            <DR label="Date &amp; heure" value={fmtDateTime(appointment.scheduled_at)} />
            <DR label="Durée" value={appointment.duration_minutes != null ? `${appointment.duration_minutes} min` : null} />
            <DR label="Notes" value={appointment.notes} />
          </div>

          {/* Inline status change */}
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Changer le statut</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <button key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    appointment.status === s
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.patient")} <span className="text-red-500">*</span></label>
                <select {...field("patient_id")} className={inputCls}>
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.title")} <span className="text-red-500">*</span></label>
                <input {...field("title")} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.type")}</label>
                  <select {...field("type")} className={inputCls}>
                    {TYPES.map(tp => <option key={tp} value={tp}>{TYPE_LABEL[tp]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.status")}</label>
                  <select {...field("status")} className={inputCls}>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.scheduledAt")} <span className="text-red-500">*</span></label>
                  <input type="datetime-local" {...field("scheduled_at")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.duration")}</label>
                  <input type="number" min="0" {...field("duration_minutes")} className={inputCls} />
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
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Supprimer ce rendez-vous ?</h2>
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
