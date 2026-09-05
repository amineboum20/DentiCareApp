"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { AppointmentWithPatient, Patient, AppointmentType, AppointmentStatus } from "@/types/database";
import { useAppContext } from "@/components/AppContext";
import { PraticienSelect } from "@/components/PraticienSelect";
import LocalInstant from "@/components/LocalInstant";

interface Props {
  initialAppointments: AppointmentWithPatient[];
  patients: Pick<Patient, "id" | "first_name" | "last_name">[];
}

const TYPES: AppointmentType[] = ["consultation", "nettoyage", "soin", "chirurgie", "controle", "orthodontie", "autre"];
const STATUSES: AppointmentStatus[] = ["planifie", "termine", "annule", "absent"];

const TYPE_EMOJI: Record<string, string> = {
  consultation: "🩺",
  nettoyage: "🪥",
  soin: "🦷",
  chirurgie: "⚕️",
  controle: "✅",
  orthodontie: "😁",
  autre: "📅",
};

const STATUS_STYLE: Record<string, string> = {
  planifie: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  termine:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  annule:   "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  absent:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

const emptyForm = {
  patient_id: "",
  title: "",
  scheduled_at: "",
  duration_minutes: "30",
  type: "consultation" as AppointmentType,
  status: "planifie" as AppointmentStatus,
  praticien_id: "",
  notes: "",
};

function patientName(appt: AppointmentWithPatient) {
  if (!appt.patients) return "—";
  return `${appt.patients.first_name} ${appt.patients.last_name}`;
}

export default function AppointmentsClient({ initialAppointments, patients }: Props) {
  const t = useTranslations("appointments");
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const { practiceId, currentUserId } = useAppContext();

  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>(initialAppointments);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("planifie");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentWithPatient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentWithPatient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Optional dossier attach for a new RDV (mirrors the visite form).
  const [rdvDossierId, setRdvDossierId] = useState("");
  const [rdvOpenDossiers, setRdvOpenDossiers] = useState<{ id: string; title: string }[]>([]);
  const [rdvNewDossierMode, setRdvNewDossierMode] = useState(false);
  const [rdvNewDossierTitle, setRdvNewDossierTitle] = useState("");
  const [rdvCreatingDossier, setRdvCreatingDossier] = useState(false);

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    router.push(`/${locale}/dashboard/appointments/${id}`);
  }, [searchParams, locale, router]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const patientId = searchParams.get("patient_id") ?? "";
    setEditing(null);
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({ ...emptyForm, patient_id: patientId, scheduled_at: local });
    setRdvDossierId(""); setRdvNewDossierMode(false); setRdvNewDossierTitle("");
    setError("");
    setModalOpen(true);
  }, [searchParams]);

  // Load the selected patient's OPEN dossiers so a new RDV can attach to one.
  useEffect(() => {
    if (!modalOpen || editing || !form.patient_id) { setRdvOpenDossiers([]); return; }
    supabase.from("dossiers").select("id, title").eq("patient_id", form.patient_id).eq("statut", "ouvert").is("archived_at", null).order("created_at", { ascending: false })
      .then(({ data }) => setRdvOpenDossiers((data ?? []) as { id: string; title: string }[]));
  }, [modalOpen, editing, form.patient_id, supabase]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return appointments.filter((a) => {
      const name = patientName(a).toLowerCase();
      const matchSearch = name.includes(q) || a.title.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [appointments, search, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentWithPatient[]>();
    filtered.forEach((a) => {
      const day = a.scheduled_at.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(a);
    });
    // Soonest first: days ascending, and each day's slots ascending by time.
    for (const list of map.values()) list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openAdd() {
    setEditing(null);
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setForm({ ...emptyForm, scheduled_at: local });
    setRdvDossierId(""); setRdvNewDossierMode(false); setRdvNewDossierTitle("");
    setError("");
    setModalOpen(true);
  }
  async function createRdvDossier() {
    if (!rdvNewDossierTitle.trim() || !form.patient_id) return;
    setRdvCreatingDossier(true);
    const { data, error: e } = await supabase.from("dossiers").insert({
      practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
      patient_id: form.patient_id, title: rdvNewDossierTitle.trim(), statut: "ouvert",
    }).select("id, title").single();
    setRdvCreatingDossier(false);
    if (e || !data) return;
    setRdvOpenDossiers((xs) => [{ id: data.id as string, title: data.title as string }, ...xs]);
    setRdvDossierId(data.id as string);
    setRdvNewDossierMode(false); setRdvNewDossierTitle("");
  }

  async function handleSave() {
    if (!form.title.trim() || !form.scheduled_at) {
      setError(t("form.requiredError"));
      return;
    }
    // A RDV is a future plan — block creating one in the past (editing an
    // already-past RDV stays allowed, since it simply aged).
    if (!editing && form.scheduled_at.slice(0, 10) < new Date().toLocaleDateString("en-CA")) {
      setError("Un rendez-vous ne peut pas être dans le passé — enregistrez plutôt une visite.");
      return;
    }
    if (form.scheduled_at.slice(0, 10) > new Date().toLocaleDateString("en-CA") && (form.status === "termine" || form.status === "absent")) {
      setError("Un rendez-vous à venir ne peut être que « Planifié » ou « Annulé ».");
      return;
    }
    setSaving(true);
    setError("");

    const patient = patients.find((p) => p.id === form.patient_id);
    const patientSnap = patient
      ? { first_name: patient.first_name, last_name: patient.last_name }
      : null;

    const payload = {
      patient_id: form.patient_id || null,
      title: form.title.trim(),
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      type: form.type,
      status: form.status,
      praticien_id: form.praticien_id || null,
      notes: form.notes.trim() || null,
    };

    if (editing) {
      const { data, error: err } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setAppointments((as) =>
        as.map((a) =>
          a.id === data.id ? { ...data, patients: patientSnap } as AppointmentWithPatient : a
        )
      );
    } else {
      const { data, error: err } = await supabase
        .from("appointments")
        .insert({ ...payload, dossier_id: rdvDossierId || null, practice_id: practiceId, created_by: currentUserId, user_id: currentUserId })
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setAppointments((as) =>
        [...as, { ...data, patients: patientSnap } as AppointmentWithPatient].sort(
          (a, b) => b.scheduled_at.localeCompare(a.scheduled_at)
        )
      );
    }

    setSaving(false);
    setModalOpen(false);
  }

  async function handleStatusChange(appt: AppointmentWithPatient, status: AppointmentStatus) {
    const { data } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appt.id)
      .select()
      .single();
    if (data) {
      setAppointments((as) =>
        as.map((a) =>
          a.id === data.id ? { ...data, patients: appt.patients } as AppointmentWithPatient : a
        )
      );
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("appointments").delete().eq("id", deleteTarget.id);
    setAppointments((as) => as.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  // Compute "today"/"tomorrow" only after mount so the server and the first
  // client render produce identical HTML (avoids a hydration mismatch from
  // calling Date.now()/new Date() during render).
  const [nowRef, setNowRef] = useState<{ today: string; tomorrow: string } | null>(null);
  useEffect(() => {
    setNowRef({
      today: new Date().toISOString().slice(0, 10),
      tomorrow: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    });
  }, []);

  function formatDayHeader(iso: string) {
    const d = new Date(iso + "T00:00:00");
    if (nowRef && iso === nowRef.today) return t("today");
    if (nowRef && iso === nowRef.tomorrow) return t("tomorrow");
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  const statusBarColor: Record<string, string> = {
    planifie: "bg-teal-400",
    termine:  "bg-emerald-400",
    annule:   "bg-red-400",
    absent:   "bg-amber-400",
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
        >
          + {t("newAppointment")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-9 pe-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg overflow-x-auto">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              {s === "all" ? t("allStatuses") : t(`statuses.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar-style list */}
      {grouped.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center py-20 text-center">
          <span className="text-4xl mb-3">{search ? "🔍" : "📅"}</span>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {search || statusFilter !== "all" ? t("noResults") : t("noAppointments")}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {search || statusFilter !== "all"
              ? t("noResultsDesc", { query: search })
              : t("noAppointmentsDesc")}
          </p>
          {!search && statusFilter === "all" && (
            <button
              onClick={openAdd}
              className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
            >
              + {t("newAppointment")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, appts]) => (
            <div key={day}>
              <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 capitalize">
                {formatDayHeader(day)}
              </h2>
              <div className="space-y-2">
                {appts.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/${locale}/dashboard/appointments/${a.id}`)}
                    className="flex items-center gap-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
                  >
                    {/* Time */}
                    <div className="w-14 text-center shrink-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                        <LocalInstant iso={a.scheduled_at} options={{ hour: "2-digit", minute: "2-digit" }} />
                      </p>
                      {a.duration_minutes != null && (
                        <p className="text-xs text-zinc-400">{a.duration_minutes} min</p>
                      )}
                    </div>
                    {/* Color bar */}
                    <div
                      className={`w-1 self-stretch rounded-full shrink-0 ${statusBarColor[a.status] ?? "bg-zinc-300"}`}
                    />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{TYPE_EMOJI[a.type] ?? "📅"}</span>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                          {a.title}
                        </p>
                      </div>
                      {a.patients && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {a.patients.first_name} {a.patients.last_name}
                        </p>
                      )}
                    </div>
                    {/* Status badge */}
                    <select
                      value={a.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleStatusChange(a, e.target.value as AppointmentStatus)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 ${STATUS_STYLE[a.status] ?? ""}`}
                    >
                      {STATUSES.filter((s) => !nowRef || a.scheduled_at.slice(0, 10) <= nowRef.today || s === "planifie" || s === "annule" || s === a.status).map((s) => (
                        <option key={s} value={s} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                          {t(`statuses.${s}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                {editing ? t("form.editTitle") : t("form.addTitle")}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.title")} <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder={t("form.titlePlaceholder")}
                  className={inputCls}
                />
              </div>
              {/* Patient + Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.patient")}
                  </label>
                  <select
                    value={form.patient_id}
                    onChange={(e) => setField("patient_id", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t("form.noPatient")}</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.type")}
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setField("type", e.target.value)}
                    className={inputCls}
                  >
                    {TYPES.map((tp) => (
                      <option key={tp} value={tp}>
                        {TYPE_EMOJI[tp]} {t(`types.${tp}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Date/time + Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.scheduledAt")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    min={!editing && nowRef ? `${nowRef.today}T00:00` : undefined}
                    onChange={(e) => setField("scheduled_at", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.duration")}
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="30"
                    value={form.duration_minutes}
                    onChange={(e) => setField("duration_minutes", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.status")}
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value)}
                  className={inputCls}
                >
                  {STATUSES.filter((s) => !form.scheduled_at || !nowRef || form.scheduled_at.slice(0, 10) <= nowRef.today || s === "planifie" || s === "annule" || s === form.status).map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Dentiste</label>
                <PraticienSelect value={form.praticien_id} onChange={(id) => setField("praticien_id", id)} className={inputCls} />
              </div>
              {/* Rattacher à un dossier (nouveau RDV uniquement) */}
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Rattacher à un dossier</label>
                  {!rdvNewDossierMode ? (
                    <div className="flex gap-1">
                      <select value={rdvDossierId} onChange={(e) => setRdvDossierId(e.target.value)} className={`flex-1 ${inputCls}`} disabled={!form.patient_id}>
                        <option value="">— Aucun —</option>
                        {rdvOpenDossiers.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                      </select>
                      <button type="button" onClick={() => { setRdvNewDossierMode(true); setRdvNewDossierTitle(""); }} disabled={!form.patient_id} title="Nouveau dossier" className="px-2.5 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100 text-sm font-bold transition-colors disabled:opacity-40 shrink-0">+</button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <input value={rdvNewDossierTitle} onChange={(e) => setRdvNewDossierTitle(e.target.value)} placeholder="Intitulé du dossier" className={`flex-1 ${inputCls}`} />
                      <button type="button" onClick={createRdvDossier} disabled={rdvCreatingDossier || !rdvNewDossierTitle.trim()} className="px-2.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition-colors disabled:opacity-40 shrink-0">{rdvCreatingDossier ? "…" : "Créer"}</button>
                      <button type="button" onClick={() => { setRdvNewDossierMode(false); setRdvNewDossierTitle(""); }} className="px-2 text-zinc-400 hover:text-zinc-600 text-sm shrink-0">✕</button>
                    </div>
                  )}
                  {!form.patient_id && <p className="text-[11px] text-zinc-400 mt-1">Sélectionnez d&apos;abord un patient.</p>}
                </div>
              )}
              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.notes")}
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editing && (
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(editing); setModalOpen(false); }}
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

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">
              {t("deleteConfirm.title")}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              {t("deleteConfirm.message", { title: deleteTarget.title })}
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
