"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { AppointmentWithPatient, Patient, ConsultationMotif, ActeScope } from "@/types/database";
import { DR } from "@/components/DetailRow";
import { useAppContext } from "@/components/AppContext";
import { billActesToDossier } from "@/utils/billing";
import ToothPicker from "@/components/ToothPicker";
import { PraticienSelect } from "@/components/PraticienSelect";
import WeekSlotPicker, { type SlotAppointment } from "@/components/WeekSlotPicker";
import LocalInstant from "@/components/LocalInstant";
import SearchableSelect from "@/components/SearchableSelect";

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


const TYPES: AppointmentType[] = ["premiere_visite", "controle", "soin", "urgence", "autre"];

const emptyForm = {
  patient_id: "", title: "",
  type: "controle" as AppointmentType,
  status: "planifie" as AppointmentStatus,
  scheduled_at: "", duration_minutes: "", praticien_id: "", notes: "",
  contact_first_name: "", contact_last_name: "", contact_phone: "",
};

export default function AppointmentDetailClient({ appointment: initialAppointment, patients, locale }: Props) {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const tv = useTranslations("visites");
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { practiceId, currentUserId, memberRole } = useAppContext();
  // Assistants schedule/cancel RDV only — never mark "Terminé" (that creates a clinical visite).
  const isAssistant = memberRole === "assistant";

  const [appointment, setAppointment] = useState<AppointmentWithPatient>(initialAppointment);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // Existing patients for the picker; contactMode edits the RDV's quick contact
  // (form.contact_*). promoting = turning that contact into a real patient.
  const [patientList, setPatientList] = useState(patients);
  const [contactMode, setContactMode] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [allAppts, setAllAppts] = useState<SlotAppointment[]>([]);
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
  const [billActes, setBillActes] = useState<{ id: string; name: string; price: number; scope?: ActeScope; teeth?: string[]; category?: string; tooth_status?: string | null }[]>([]);
  const [actes, setActes] = useState<{ id: string; name: string; price: number; scope: ActeScope; category: string; tooth_status: string | null }[]>([]);
  const [linkedVisite, setLinkedVisite] = useState<{ id: string; exam_date: string; motif: string } | null>(null);
  const today = new Date().toLocaleDateString("en-CA");
  const isPastOrNow = appointment.scheduled_at.slice(0, 10) <= today;
  // A future RDV can only be Planifié or Annulé; Terminé/Absent need it to have
  // happened. Keep the current status selectable even if it breaks the rule.
  // Status options are time-based and the same for every role: a past/today RDV
  // can only be marked Terminé or Absent (it has happened), a future one only
  // Planifié or Annulé (it hasn't). An assistant's "Terminé" just records
  // attendance — the visite/billing dialog stays dentist-only (see handleStatusChange).
  const allowedStatuses: AppointmentStatus[] = isPastOrNow ? ["termine", "absent"] : ["planifie", "annule"];

  const patientData = appointment.patients as { first_name: string; last_name: string; phone?: string | null } | null;
  const contactName = `${appointment.contact_first_name ?? ""} ${appointment.contact_last_name ?? ""}`.trim();
  const isContact = !appointment.patient_id && !!contactName; // a quick contact, not a real patient yet
  const patientName = patientData ? `${patientData.first_name} ${patientData.last_name}` : (contactName || null);
  const patientPhone = patientData?.phone ?? appointment.contact_phone ?? null;
  // Linked dossier comes from the server prop (a to-one embed; array-guarded per
  // Supabase). Kept from the initial prop since edits don't change dossier_id.
  const dossierRel = (initialAppointment as { dossiers?: { title: string } | { title: string }[] | null }).dossiers;
  const dossierTitle = Array.isArray(dossierRel) ? (dossierRel[0]?.title ?? null) : (dossierRel?.title ?? null);

  // Load the practice's appointments so the edit slot picker can show busy blocks.
  useEffect(() => {
    if (!modalOpen) return;
    supabase.from("appointments").select("id, scheduled_at, duration_minutes, status, praticien_id, patients(first_name, last_name)").is("archived_at", null)
      .then(({ data }) => setAllAppts((data ?? []) as unknown as SlotAppointment[]));
  }, [modalOpen, supabase]);

  // Load the linked visite (if any) for display on the RDV.
  useEffect(() => {
    if (!appointment.consultation_id) { setLinkedVisite(null); return; }
    supabase.from("consultations").select("id, exam_date, motif").eq("id", appointment.consultation_id).single()
      .then(({ data }) => setLinkedVisite((data as { id: string; exam_date: string; motif: string } | null) ?? null));
  }, [appointment.consultation_id, supabase]);

  // When the terminer dialog opens: load the acte catalogue and the patient's visites.
  useEffect(() => {
    if (!terminerOpen) return;
    supabase.from("actes").select("id, name, price, scope, category, tooth_status").order("name").then(({ data }) => {
      const list = (data ?? []) as { id: string; name: string; price: number; scope: ActeScope; category: string; tooth_status: string | null }[];
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
    if (newStatus === "termine" && !isAssistant && isPastOrNow && !appointment.consultation_id && appointment.patient_id) {
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

    let linkDossierId = appointment.dossier_id;

    if (linkMode === "new") {
      const motif = TYPE_TO_MOTIF[appointment.type] ?? "consultation";
      // Every visite belongs to a dossier — create one if the RDV has none,
      // regardless of whether it's being billed.
      if (!linkDossierId) {
        const { data: dz } = await supabase.from("dossiers").insert({
          practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
          patient_id: appointment.patient_id as string,
          title: t("detail.autoDossierTitle", { date: new Date(appointment.scheduled_at).toLocaleDateString("fr-FR") }),
          statut: "ouvert",
        }).select("id").single();
        if (dz) linkDossierId = (dz as { id: string }).id;
      }
      const { data: cons, error } = await supabase.from("consultations").insert({
        practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
        patient_id: appointment.patient_id, dossier_id: linkDossierId,
        motif, exam_date: appointment.scheduled_at.slice(0, 10),
        clinical_notes: appointment.notes?.trim() || null,
      }).select("id").single();
      if (error || !cons) { setTerminering(false); return; }
      visiteId = (cons as { id: string }).id;
      if (billOn && billActes.length > 0 && linkDossierId) {
        await billActesToDossier(supabase, { practiceId, userId: currentUserId, patientId: appointment.patient_id as string, dossierId: linkDossierId, actes: billActes });
      }
    }

    if (!visiteId) { setTerminering(false); return; } // "existing" mode needs a selection
    await supabase.from("appointments").update({ status: "termine", consultation_id: visiteId, dossier_id: linkDossierId }).eq("id", appointment.id);
    setAppointment((a) => ({ ...a, status: "termine", consultation_id: visiteId, dossier_id: linkDossierId }));
    setTerminering(false); setTerminerOpen(false);
  }

  function openEdit() {
    // scheduled_at is a UTC instant; convert to a LOCAL datetime-local string
    // (subtract the offset) so the picker/inputs show the wall-clock time, not UTC.
    const d0 = appointment.scheduled_at ? new Date(appointment.scheduled_at) : null;
    const localDt = d0 ? new Date(d0.getTime() - d0.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    setForm({
      patient_id: appointment.patient_id ?? "",
      title: appointment.title,
      type: appointment.type as AppointmentType,
      status: appointment.status as AppointmentStatus,
      scheduled_at: localDt,
      duration_minutes: String(appointment.duration_minutes ?? ""),
      praticien_id: appointment.praticien_id ?? "",
      notes: appointment.notes ?? "",
      contact_first_name: appointment.contact_first_name ?? "",
      contact_last_name: appointment.contact_last_name ?? "",
      contact_phone: appointment.contact_phone ?? "",
    });
    setContactMode(!appointment.patient_id && !!(appointment.contact_first_name || appointment.contact_last_name));
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

  // Promote the RDV's quick contact into a real patient (when they show up).
  async function promoteToPatient() {
    if (!appointment.contact_first_name && !appointment.contact_last_name) return;
    setPromoting(true);
    const { data: p, error } = await supabase.from("patients").insert({
      practice_id: practiceId, user_id: currentUserId, created_by: currentUserId,
      first_name: (appointment.contact_first_name ?? "").trim() || (appointment.contact_last_name ?? "").trim(),
      last_name: (appointment.contact_last_name ?? "").trim(),
      phone: appointment.contact_phone ?? null,
    }).select("id, first_name, last_name").single();
    if (error || !p) { setPromoting(false); return; }
    const pid = (p as { id: string }).id;
    const { data: appt } = await supabase.from("appointments")
      .update({ patient_id: pid, contact_first_name: null, contact_last_name: null, contact_phone: null })
      .eq("id", appointment.id).select("*, patients(first_name, last_name, phone)").single();
    if (appt) setAppointment(appt as AppointmentWithPatient);
    setPatientList(xs => [...xs, p as Pick<Patient, "id" | "first_name" | "last_name">].sort((a, b) => a.last_name.localeCompare(b.last_name)));
    setPromoting(false);
  }

  async function handleSave() {
    const missing: string[] = [];
    if (!form.title.trim()) missing.push(t("form.title"));
    if (!form.scheduled_at) missing.push(t("form.scheduledAt"));
    if (missing.length) { setFormError(t("form.missingFields", { fields: missing.join(", ") })); return; }
    if (form.scheduled_at.slice(0, 10) > today && (form.status === "termine" || form.status === "absent")) {
      setFormError(t("errFutureStatus"));
      return;
    }
    setSaving(true); setFormError("");
    const payload = {
      patient_id: form.patient_id || null,
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      praticien_id: form.praticien_id || null,
      notes: form.notes.trim() || null,
      contact_first_name: form.patient_id ? null : (form.contact_first_name.trim() || null),
      contact_last_name: form.patient_id ? null : (form.contact_last_name.trim() || null),
      contact_phone: form.patient_id ? null : (form.contact_phone.trim() || null),
    };
    const { data, error } = await supabase.from("appointments").update(payload).eq("id", appointment.id).select("*, patients(first_name, last_name, phone)").single();
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
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
            {linkedVisite && !isAssistant && (
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

        {/* Patient / contact quick actions (like the patient profile) */}
        {(appointment.patient_id || isContact) && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 h-fit">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">{t("detail.patientCard")}</h2>
            {appointment.patient_id ? (
              <button onClick={() => router.push(`/${locale}/dashboard/patients/${appointment.patient_id}`)} className="text-base font-semibold text-zinc-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors block text-left">{patientName}</button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-zinc-900 dark:text-white">{patientName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{t("detail.contactBadge")}</span>
              </div>
            )}
            {patientPhone && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{patientPhone}</p>}
            {patientPhone && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <a href={`tel:${patientPhone.replace(/\D/g, "")}`} className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-300">
                  <span className="text-lg">📞</span>
                  <span className="text-[11px] font-medium leading-tight">{t("detail.call")}</span>
                </a>
                <a href={`https://wa.me/${patientPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-emerald-600 dark:text-emerald-400">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.454h.005c6.585 0 11.945-5.335 11.948-11.893a11.821 11.821 0 00-3.483-8.436Z"/></svg>
                  <span className="text-[11px] font-medium leading-tight">{t("detail.whatsapp")}</span>
                </a>
              </div>
            )}
            {appointment.patient_id ? (
              <button onClick={() => router.push(`/${locale}/dashboard/patients/${appointment.patient_id}`)} className="w-full mt-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:border-teal-300 dark:hover:border-teal-700 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">{t("detail.viewProfile")}</button>
            ) : (
              <button onClick={promoteToPatient} disabled={promoting} className="w-full mt-3 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{promoting ? "…" : t("detail.createPatientFile")}</button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-6 pb-8">
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("form.patient")}</label>
                  <button type="button" onClick={() => { setContactMode(v => !v); if (!contactMode) setForm(f => ({ ...f, patient_id: "" })); setFormError(""); }} className="text-xs text-teal-600 dark:text-teal-400 hover:underline">
                    {contactMode ? t("form.cancelNewPatient") : t("form.quickContact")}
                  </button>
                </div>
                {contactMode ? (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 bg-zinc-50/60 dark:bg-zinc-800/30">
                    <div className="grid grid-cols-2 gap-2">
                      <input {...field("contact_first_name")} placeholder={t("form.npFirstName")} className={inputCls} />
                      <input {...field("contact_last_name")} placeholder={t("form.npLastName")} className={inputCls} />
                    </div>
                    <input {...field("contact_phone")} placeholder={t("form.npPhone")} className={inputCls} />
                    <p className="text-[10px] text-zinc-400">{t("form.contactHint")}</p>
                  </div>
                ) : (
                  <SearchableSelect
                    value={form.patient_id}
                    onChange={(v) => setForm(f => ({ ...f, patient_id: v, contact_first_name: "", contact_last_name: "", contact_phone: "" }))}
                    options={patientList.map(p => ({ value: p.id, label: `${p.last_name} ${p.first_name}` }))}
                    placeholder={t("detail.selectPatient")}
                    searchPlaceholder={t("searchPatientPlaceholder")}
                    emptyLabel={t("noResults")}
                    className={inputCls}
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.title")} <span className="text-red-500">*</span></label>
                <input {...field("title")} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.type")}</label>
                <select {...field("type")} className={inputCls}>
                  {TYPES.map(tp => <option key={tp} value={tp}>{t(`types.${tp}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("detail.dentist")}</label>
                <PraticienSelect value={form.praticien_id} onChange={(id) => setForm((f) => ({ ...f, praticien_id: id }))} className={inputCls} />
              </div>
              {/* Reschedule via the same week picker as create; status is changed
                  through the "Changer le statut" chips on the RDV page. */}
              <WeekSlotPicker
                praticienId={form.praticien_id}
                appointments={allAppts}
                excludeId={appointment.id}
                valueLocal={form.scheduled_at}
                durationMinutes={parseInt(form.duration_minutes || "30") || 30}
                onChange={(at, dur) => setForm((f) => ({ ...f, scheduled_at: at, duration_minutes: String(dur) }))}
              />
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.notes")}</label>
                <textarea {...field("notes")} rows={3} className={`${inputCls} resize-none`} />
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {formError && <span className="text-sm font-medium text-red-500 me-2">{formError}</span>}
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
                {!appointment.dossier_id && <p className="text-[11px] text-zinc-400">{t("detail.autoDossierNote", { date: new Date(appointment.scheduled_at).toLocaleDateString("fr-FR") })}</p>}
                {billOn && (
                  actes.length > 0 ? (
                    <div className="space-y-2">
                      {billActes.length > 0 && (
                        <div className="space-y-1">
                          {billActes.map((a, i) => (
                            <div key={i} className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{a.name}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs text-zinc-500">{a.price.toFixed(2)} MAD</span>
                                  <button type="button" onClick={() => setBillActes((xs) => xs.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-red-500 text-sm">✕</button>
                                </div>
                              </div>
                              {a.scope === "tooth" && (
                                <div className="mt-2">
                                  <ToothPicker value={a.teeth ?? []} onChange={(teeth) => setBillActes((xs) => xs.map((x, j) => (j === i ? { ...x, teeth } : x)))} />
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 text-center">
                                    {a.teeth && a.teeth.length ? a.teeth.join(", ") : t("detail.teethPlaceholder")}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <select value="" onChange={(e) => { const a = actes.find((x) => x.id === e.target.value); if (a) setBillActes((xs) => [...xs, { id: a.id, name: a.name, price: a.price, scope: a.scope, category: a.category, tooth_status: a.tooth_status, teeth: [] }]); }} className={inputCls}>
                        <option value="">+ {t("detail.addActe")}</option>
                        {actes.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.price.toFixed(2)} MAD</option>)}
                      </select>
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
