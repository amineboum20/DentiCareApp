"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { AppointmentWithPatient, Patient, ConsultationMotif } from "@/types/database";
import { DR } from "@/components/DetailRow";
import { useAppContext } from "@/components/AppContext";
import { billActesToDossier } from "@/utils/billing";
import { PraticienSelect } from "@/components/PraticienSelect";
import LocalInstant from "@/components/LocalInstant";

// Map an appointment type onto a visite motif (covers both type vocabularies).
const TYPE_TO_MOTIF: Record<string, ConsultationMotif> = {
  consultation: "consultation", controle: "controle", soin: "soin",
  nettoyage: "soin", chirurgie: "soin", orthodontie: "soin",
  urgence: "urgence", premiere_visite: "consultation", autre: "autre",
};

interface Props {
  appointment: AppointmentWithPatient & { dossiers?: { title: string } | { title: string }[] | null };
  patients: Pick<Patient, "id" | "first_name" | "last_name">[];
  locale: string;
}

type AppointmentStatus = "planifie" | "termine" | "annule" | "absent";
type AppointmentType = "premiere_visite" | "controle" | "soin" | "urgence" | "autre";

const STATUS_STYLE: Record<string, string> = {
  planifie: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  termine:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  annule:   "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  absent:   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUSES: AppointmentStatus[] = ["planifie", "termine", "annule", "absent"];

const TYPES: AppointmentType[] = ["premiere_visite", "controle", "soin", "urgence", "autre"];

const emptyForm = {
  patient_id: "", title: "",
  type: "controle" as AppointmentType,
  status: "planifie" as AppointmentStatus,
  scheduled_at: "", duration_minutes: "", praticien_id: "", notes: "",
};

export default function AppointmentDetailClient({ appointment: initialAppointment, patients, locale }: Props) {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const tv = useTranslations("visites");
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { practiceId, currentUserId } = useAppContext();

  const [appointment, setAppointment] = useState<AppointmentWithPatient>(initialAppointment);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Terminer + link a visite: a RDV is not a visite; once its time has passed and
  // it is marked "Terminé", it is linked to an existing visite or a new one.
  const [terminerOpen, setTerminerOpen] = useState(false);
  const [terminering, setTerminering] = useState(false);
  const [linkMode, setLinkMode] = useState<"new" | "existing">("new");
  const [existingVisiteId, setExistingVisiteId] = useState("");
  const [patientVisites, setPatientVisites] = useState<{ id: string; exam_date: string; motif: string }[]>([]);
  const [billOn, setBillOn] = useState(true);
  const [billActes, setBillActes] = useState<{ id: string; name: string; price: number }[]>([]);
  const [actes, setActes] = useState<{ id: string; name: string; price: number }[]>([]);
  const [linkedVisite, setLinkedVisite] = useState<{ id: string; exam_date: string; motif: string } | null>(null);
  const today = new Date().toLocaleDateString("en-CA");
  const isPastOrNow = appointment.scheduled_at.slice(0, 10) <= today;
  // A future RDV can only be Planifié or Annulé; Terminé/Absent need it to have
  // happened. Keep the current status selectable even if it breaks the rule.
  const allowedStatuses = STATUSES.filter(s => isPastOrNow || s === "planifie" || s === "annule" || s === appointment.status);

  const patientData = appointment.patients as { first_name: string; last_name: string } | null;
  const patientName = patientData ? `${patientData.first_name} ${patientData.last_name}` : null;
  // Linked dossier comes from the server prop (a to-one embed; array-guarded per
  // Supabase). Kept from the initial prop since edits don't change dossier_id.
  const dossierRel = (initialAppointment as { dossiers?: { title: string } | { title: string }[] | null }).dossiers;
  const dossierTitle = Array.isArray(dossierRel) ? (dossierRel[0]?.title ?? null) : (dossierRel?.title ?? null);

  // Load the linked visite (if any) for display on the RDV.
  useEffect(() => {
    if (!appointment.consultation_id) { setLinkedVisite(null); return; }
    supabase.from("consultations").select("id, exam_date, motif").eq("id", appointment.consultation_id).single()
      .then(({ data }) => setLinkedVisite((data as { id: string; exam_date: string; motif: string } | null) ?? null));
  }, [appointment.consultation_id, supabase]);

  // When the terminer dialog opens: load the acte catalogue and the patient's visites.
  useEffect(() => {
    if (!terminerOpen) return;
    supabase.from("actes").select("id, name, price").order("name").then(({ data }) => {
      const list = (data ?? []) as { id: string; name: string; price: number }[];
      setActes(list);
      const cons = list.find((a) => a.name.toLowerCase() === "consultation") ?? list[0];
      setBillActes(cons ? [cons] : []);
    });
    if (appointment.patient_id) {
      supabase.from("consultations").select("id, exam_date, motif").eq("patient_id", appointment.patient_id).order("exam_date", { ascending: false })
        .then(({ data }) => setPatientVisites((data ?? []) as { id: string; exam_date: string; motif: string }[]));
    }
  }, [terminerOpen, appointment.patient_id, supabase]);

  async function handleStatusChange(newStatus: AppointmentStatus) {
    // Marking a now/past RDV "Terminé" (not yet linked) prompts linking a visite.
    if (newStatus === "termine" && isPastOrNow && !appointment.consultation_id && appointment.patient_id) {
      setLinkMode("new"); setExistingVisiteId(""); setBillOn(true); setTerminerOpen(true);
      return;
    }
    await supabase.from("appointments").update({ status: newStatus }).eq("id", appointment.id);
    setAppointment(a => ({ ...a, status: newStatus }));
  }

  async function doTerminer() {
    if (!appointment.patient_id) return;
    setTerminering(true);
    let visiteId = existingVisiteId;

    if (linkMode === "new") {
      const motif = TYPE_TO_MOTIF[appointment.type] ?? "consultation";
      const { data: cons, error } = await supabase.from("consultations").insert({
        practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
        patient_id: appointment.patient_id, dossier_id: appointment.dossier_id,
        motif, exam_date: appointment.scheduled_at.slice(0, 10),
        clinical_notes: appointment.notes?.trim() || null,
      }).select("id").single();
      if (error || !cons) { setTerminering(false); return; }
      visiteId = (cons as { id: string }).id;
      // Bill actes; if the RDV had no dossier, auto-create one and attach the visite.
      if (billOn && billActes.length > 0) {
        let targetDossierId = appointment.dossier_id;
        if (!targetDossierId) {
          const { data: dz } = await supabase.from("dossiers").insert({
            practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
            patient_id: appointment.patient_id as string, title: t("detail.autoDossierTitle", { date: new Date(appointment.scheduled_at).toLocaleDateString("fr-FR") }), statut: "ouvert",
          }).select("id").single();
          if (dz) {
            targetDossierId = (dz as { id: string }).id;
            await supabase.from("consultations").update({ dossier_id: targetDossierId }).eq("id", visiteId);
          }
        }
        if (targetDossierId) {
          await billActesToDossier(supabase, { practiceId, userId: currentUserId, patientId: appointment.patient_id as string, dossierId: targetDossierId, actes: billActes });
        }
      }
    }

    if (!visiteId) { setTerminering(false); return; } // "existing" mode needs a selection
    await supabase.from("appointments").update({ status: "termine", consultation_id: visiteId }).eq("id", appointment.id);
    setAppointment((a) => ({ ...a, status: "termine", consultation_id: visiteId }));
    setTerminering(false); setTerminerOpen(false);
  }

  function openEdit() {
    const localDt = appointment.scheduled_at
      ? new Date(appointment.scheduled_at).toISOString().slice(0, 16)
      : "";
    setForm({
      patient_id: appointment.patient_id ?? "",
      title: appointment.title,
      type: appointment.type as AppointmentType,
      status: appointment.status as AppointmentStatus,
      scheduled_at: localDt,
      duration_minutes: String(appointment.duration_minutes ?? ""),
      praticien_id: appointment.praticien_id ?? "",
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
      setFormError(t("detail.errRequired"));
      return;
    }
    if (form.scheduled_at.slice(0, 10) > today && (form.status === "termine" || form.status === "absent")) {
      setFormError(t("errFutureStatus"));
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
      praticien_id: form.praticien_id || null,
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
          {tc("back")}
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
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{t("detail.informations")}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[appointment.status] ?? ""}`}>
              {t(`statuses.${appointment.status}`)}
            </span>
          </div>
          <div className="space-y-1">
            <DR label={t("detail.patient")} value={patientName} />
            {dossierTitle && appointment.dossier_id && (
              <div className="flex gap-3 py-0.5">
                <span className="text-xs text-zinc-400 w-32 shrink-0 pt-0.5">{t("detail.dossier")}</span>
                <button onClick={() => router.push(`/${locale}/dashboard/dossiers/${appointment.dossier_id}`)} className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline text-left">{dossierTitle} →</button>
              </div>
            )}
            {linkedVisite && (
              <div className="flex gap-3 py-0.5">
                <span className="text-xs text-zinc-400 w-32 shrink-0 pt-0.5">{t("detail.linkedVisit")}</span>
                <button onClick={() => router.push(`/${locale}/dashboard/consultations/${linkedVisite.id}`)} className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline text-left">{new Date(linkedVisite.exam_date).toLocaleDateString("fr-FR")} — {tv.has(`motif.${linkedVisite.motif}`) ? tv(`motif.${linkedVisite.motif}`) : linkedVisite.motif} →</button>
              </div>
            )}
            <DR label={t("detail.type")} value={t.has(`types.${appointment.type}`) ? t(`types.${appointment.type}`) : appointment.type} />
            <DR label={t("detail.dateTime")} value={<LocalInstant iso={appointment.scheduled_at} options={{ weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }} />} />
            <DR label={t("detail.duration")} value={appointment.duration_minutes != null ? `${appointment.duration_minutes} min` : null} />
            <DR label={t("detail.notes")} value={appointment.notes} />
          </div>

          {/* Inline status change */}
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">{t("detail.changeStatus")}</label>
            <div className="flex flex-wrap gap-2">
              {allowedStatuses.map(s => (
                <button key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    appointment.status === s
                      ? `${STATUS_STYLE[s]} border-transparent ring-2 ring-offset-1 ring-teal-400`
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}>
                  {t(`statuses.${s}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 pb-8">
          <button onClick={() => setDeleteOpen(true)}
            className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
            {tc("delete")}
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.title")} <span className="text-red-500">*</span></label>
                <input {...field("title")} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.type")}</label>
                  <select {...field("type")} className={inputCls}>
                    {TYPES.map(tp => <option key={tp} value={tp}>{t(`types.${tp}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.status")}</label>
                  <select {...field("status")} className={inputCls}>
                    {STATUSES.filter(s => !form.scheduled_at || form.scheduled_at.slice(0, 10) <= today || s === "planifie" || s === "annule" || s === form.status).map(s => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("detail.dentist")}</label>
                <PraticienSelect value={form.praticien_id} onChange={(id) => setForm((f) => ({ ...f, praticien_id: id }))} className={inputCls} />
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

      {/* Terminer + link a visite */}
      {terminerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("detail.terminerTitle")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {t("detail.terminerBody1")} <LocalInstant iso={appointment.scheduled_at} options={{ weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }} /> {t("detail.terminerBody2")}
            </p>
            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg mb-4">
              <button type="button" onClick={() => setLinkMode("new")} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${linkMode === "new" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"}`}>{t("detail.newVisite")}</button>
              <button type="button" onClick={() => setLinkMode("existing")} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${linkMode === "existing" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"}`}>{t("detail.existingVisite")}</button>
            </div>

            {linkMode === "existing" ? (
              <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("detail.visiteToLink")}</label>
                <select value={existingVisiteId} onChange={(e) => setExistingVisiteId(e.target.value)} className={inputCls}>
                  <option value="">{t("detail.chooseVisite")}</option>
                  {patientVisites.map((v) => <option key={v.id} value={v.id}>{new Date(v.exam_date).toLocaleDateString("fr-FR")} — {tv.has(`motif.${v.motif}`) ? tv(`motif.${v.motif}`) : v.motif}</option>)}
                </select>
                {patientVisites.length === 0 && <p className="text-[11px] text-zinc-400 mt-1">{t("detail.noVisiteForPatient")}</p>}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 space-y-3 bg-zinc-50/60 dark:bg-zinc-800/30 mb-4">
                <p className="text-[11px] text-zinc-400">{t("detail.visiteDated", { date: new Date(appointment.scheduled_at).toLocaleDateString("fr-FR") })}{dossierTitle ? <> {t("detail.inDossier")} <span className="font-medium text-zinc-600 dark:text-zinc-300">{dossierTitle}</span></> : ""}.</p>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={billOn} onChange={(e) => setBillOn(e.target.checked)} className="w-4 h-4 accent-teal-600" />
                  {t("detail.billVisit")}
                </label>
                {billOn && (
                  actes.length > 0 ? (
                    <div className="space-y-2">
                      {billActes.length > 0 && (
                        <div className="space-y-1">
                          {billActes.map((a, i) => (
                            <div key={i} className="flex items-center justify-between rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5">
                              <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{a.name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-zinc-500">{a.price.toFixed(2)} MAD</span>
                                <button type="button" onClick={() => setBillActes((xs) => xs.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-red-500 text-sm">✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <select value="" onChange={(e) => { const a = actes.find((x) => x.id === e.target.value); if (a) setBillActes((xs) => [...xs, a]); }} className={inputCls}>
                        <option value="">+ {t("detail.addActe")}</option>
                        {actes.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.price.toFixed(2)} MAD</option>)}
                      </select>
                      {!appointment.dossier_id && <p className="text-[11px] text-zinc-400">{t("detail.autoDossierNote", { date: new Date(appointment.scheduled_at).toLocaleDateString("fr-FR") })}</p>}
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">{t("detail.noActes")}</p>
                  )
                )}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setTerminerOpen(false)} className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">{tc("cancel")}</button>
              <button onClick={doTerminer} disabled={terminering || (linkMode === "existing" && !existingVisiteId)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{terminering ? "…" : t("detail.terminer")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("detail.deleteQ")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t("detail.irreversible")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                {tc("cancel")}
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                {deleting ? t("detail.deleting") : tc("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
