"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { Patient } from "@/types/database";
import { DR } from "@/components/DetailRow";


interface Props {
  patient: Patient;
  locale: string;
}

type HistoryConsultation = {
  id: string; motif: string; exam_date: string;
  next_exam_date: string | null; treated_by: string | null; clinical_notes: string | null;
  teeth: string | null;
};

type HistoryFacture = {
  id: string; status: string; total_price: number;
  deposit_paid: number; created_at: string; notes: string | null;
};

type DetailSnapshot = {
  lastConsultation: { id: string; exam_date: string; motif: string } | null;
  nextAppointment: { id: string; title: string; scheduled_at: string } | null;
  activeFactures: { id: string; status: string; total_price: number; deposit_paid: number }[];
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

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

const emptyForm = {
  first_name: "", last_name: "", email: "",
  phone: "", date_of_birth: "", address: "", notes: "",
};

export default function PatientDetailClient({ patient: initialPatient, locale }: Props) {
  const t = useTranslations("patients");
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [patient, setPatient] = useState<Patient>(initialPatient);
  const [isMobile, setIsMobile] = useState(false);

  // Snapshot
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DetailSnapshot | null>(null);

  // History
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyConsultations, setHistoryConsultations] = useState<HistoryConsultation[]>([]);
  const [historyFactures, setHistoryFactures] = useState<HistoryFacture[]>([]);
  const [historyDossiers, setHistoryDossiers] = useState<{ id: string; title: string; statut: string; created_at: string }[]>([]);

  // Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Archive
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePreview, setArchivePreview] = useState<{ consultations: number; factures: number; appointments: number } | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const now = new Date().toISOString();
    Promise.all([
      supabase.from("consultations").select("id, exam_date, motif").eq("patient_id", patient.id).order("exam_date", { ascending: false }).limit(1),
      supabase.from("appointments").select("id, title, scheduled_at").eq("patient_id", patient.id).eq("status", "planifie").gte("scheduled_at", now).order("scheduled_at", { ascending: true }).limit(1),
      supabase.from("factures").select("id, status, total_price, deposit_paid").eq("patient_id", patient.id).in("status", ["en_attente", "en_cours"]),
    ]).then(([{ data: consultation }, { data: appt }, { data: factures }]) => {
      setSnapshot({
        lastConsultation: consultation?.[0] ?? null,
        nextAppointment: appt?.[0] ?? null,
        activeFactures: (factures ?? []) as { id: string; status: string; total_price: number; deposit_paid: number }[],
      });
      setSnapshotLoading(false);
    });
  }, [patient.id, supabase]);

  useEffect(() => {
    Promise.all([
      supabase.from("consultations").select("id, motif, exam_date, next_exam_date, treated_by, clinical_notes, teeth").eq("patient_id", patient.id).order("exam_date", { ascending: false }),
      supabase.from("factures").select("id, status, total_price, deposit_paid, created_at, notes").eq("patient_id", patient.id).order("created_at", { ascending: false }),
      supabase.from("dossiers").select("id, title, statut, created_at").eq("patient_id", patient.id).is("archived_at", null).order("created_at", { ascending: false }),
    ]).then(([{ data: consultations }, { data: factures }, { data: dossiers }]) => {
      setHistoryConsultations((consultations ?? []) as HistoryConsultation[]);
      setHistoryFactures((factures ?? []) as HistoryFacture[]);
      setHistoryDossiers((dossiers ?? []) as { id: string; title: string; statut: string; created_at: string }[]);
      setHistoryLoading(false);
    });
  }, [patient.id, supabase]);

  function openEdit() {
    setForm({
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email ?? "",
      phone: patient.phone ?? "",
      date_of_birth: patient.date_of_birth ?? "",
      address: patient.address ?? "",
      notes: patient.notes ?? "",
    });
    setFormError("");
    setModalOpen(true);
  }

  function field(key: keyof typeof emptyForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError(t("form.requiredError"));
      return;
    }
    setSaving(true); setFormError("");
    const payload = {
      first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      email: form.email.trim() || null, phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null, address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { data, error: err } = await supabase.from("patients").update(payload).eq("id", patient.id).select().single();
    if (err) { setFormError(err.message); setSaving(false); return; }
    setPatient(data as Patient);
    setSaving(false); setModalOpen(false);
  }

  async function handleArchiveStart() {
    setArchiveLoading(true);
    const [{ count: dCount }, { count: fCount }, { count: aCount }] = await Promise.all([
      supabase.from("consultations").select("*", { count: "exact", head: true }).eq("patient_id", patient.id).is("archived_at", null),
      supabase.from("factures").select("*", { count: "exact", head: true }).eq("patient_id", patient.id).is("archived_at", null),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("patient_id", patient.id).is("archived_at", null),
    ]);
    setArchivePreview({ consultations: dCount ?? 0, factures: fCount ?? 0, appointments: aCount ?? 0 });
    setArchiveLoading(false);
    setArchiveOpen(true);
  }

  async function handleArchiveConfirm() {
    setArchiveLoading(true);
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from("patients").update({ archived_at: now }).eq("id", patient.id),
      supabase.from("consultations").update({ archived_at: now }).eq("patient_id", patient.id),
      supabase.from("factures").update({ archived_at: now }).eq("patient_id", patient.id),
      supabase.from("appointments").update({ archived_at: now }).eq("patient_id", patient.id),
    ]);
    setArchiveLoading(false);
    router.push(`/${locale}/dashboard/patients`);
  }

  async function handleUnarchive() {
    setArchiveLoading(true);
    await Promise.all([
      supabase.from("patients").update({ archived_at: null }).eq("id", patient.id),
      supabase.from("consultations").update({ archived_at: null }).eq("patient_id", patient.id),
      supabase.from("factures").update({ archived_at: null }).eq("patient_id", patient.id),
      supabase.from("appointments").update({ archived_at: null }).eq("patient_id", patient.id),
    ]);
    setPatient((p) => ({ ...p, archived_at: null }));
    setArchiveLoading(false);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      {/* Back button + Title */}
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
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 dark:text-teal-400 text-xl font-bold shrink-0">
            {patient.first_name[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{patient.first_name} {patient.last_name}</h1>
              {patient.archived_at && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Archivé
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400">Ajouté le {fmtDate(patient.created_at)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start max-w-6xl">
        {/* LEFT column: contact + vue rapide */}
        <div className="space-y-6">
        {/* Section 1: Contact info */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-5">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Informations</p>
          <div className="space-y-1">
            <DR label={t("columns.phone")} value={patient.phone} />
            <DR label={t("columns.email")} value={patient.email} />
            <DR label={t("columns.dob")} value={fmtDate(patient.date_of_birth)} />
            <DR label="Adresse" value={patient.address} />
            <DR label="Notes" value={patient.notes} />
            <DR label={t("columns.added")} value={fmtDate(patient.created_at)} />
          </div>
        </div>

        {/* Section 2: Vue rapide */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-5">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2.5">Vue rapide</p>
          {snapshotLoading ? (
            <div className="flex justify-center py-3">
              <svg className="w-5 h-5 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">🏥</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Dernière visite</p>
                    <p className="text-[11px] text-zinc-400">
                      {snapshot?.lastConsultation
                        ? `${fmtDate(snapshot.lastConsultation.exam_date)} · ${snapshot.lastConsultation.motif}`
                        : "Aucune"}
                    </p>
                  </div>
                </div>
                {snapshot?.lastConsultation && (
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/consultations/${snapshot.lastConsultation!.id}`)}
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-medium shrink-0 ms-2">
                    Voir →
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">📅</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Prochain RDV</p>
                    <p className="text-[11px] text-zinc-400">
                      {snapshot?.nextAppointment
                        ? fmtDateTime(snapshot.nextAppointment.scheduled_at)
                        : "Aucun planifié"}
                    </p>
                  </div>
                </div>
                {snapshot?.nextAppointment && (
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/appointments/${snapshot.nextAppointment!.id}`)}
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-medium shrink-0 ms-2">
                    Voir →
                  </button>
                )}
              </div>
              {snapshot && snapshot.activeFactures.length > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 px-3 py-2 space-y-1.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm">🧾</span>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      {snapshot.activeFactures.length} facture{snapshot.activeFactures.length > 1 ? "s" : ""} non soldée{snapshot.activeFactures.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  {snapshot.activeFactures.map(f => (
                    <div key={f.id} className="flex items-center justify-between">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${FACTURE_STATUS_STYLE[f.status]}`}>
                        {FACTURE_STATUS_LABEL[f.status]}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                          {(f.total_price - f.deposit_paid).toFixed(2)} MAD dû
                        </span>
                        <button
                          onClick={() => router.push(`/${locale}/dashboard/factures/${f.id}`)}
                          className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-medium">
                          Voir →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        </div>{/* end left column */}

        {/* RIGHT column: actions rapides + history */}
        <div className="space-y-6 pb-8">
        {/* Section 3: Actions rapides + action bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-5">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Actions rapides</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={() => router.push(`/${locale}/dashboard/dossiers?new=1&patient_id=${patient.id}`)}
              className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-teal-600 dark:text-teal-400">
              <span className="text-lg">📁</span>
              <span className="text-[11px] font-medium leading-tight">Dossier</span>
            </button>
            <button onClick={() => router.push(`/${locale}/dashboard/consultations?new=1&patient_id=${patient.id}`)}
              className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-teal-600 dark:text-teal-400">
              <span className="text-lg">🏥</span>
              <span className="text-[11px] font-medium leading-tight">Visite</span>
            </button>
            <button onClick={() => router.push(`/${locale}/dashboard/appointments?new=1&patient_id=${patient.id}`)}
              className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-teal-600 dark:text-teal-400">
              <span className="text-lg">📅</span>
              <span className="text-[11px] font-medium leading-tight">RDV</span>
            </button>
          </div>
          {(patient.phone || (!isMobile && patient.email)) && (
            <div className={`grid gap-2 mb-2 ${patient.phone && (!isMobile ? patient.email : true) ? "grid-cols-2" : "grid-cols-1"}`}>
              {isMobile && patient.phone ? (
                <a href={`tel:${patient.phone.replace(/\D/g, "")}`}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-300">
                  <span className="text-lg">📞</span>
                  <span className="text-[11px] font-medium leading-tight">Appeler</span>
                </a>
              ) : !isMobile && patient.email ? (
                <a href={`mailto:${patient.email}`}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-300">
                  <span className="text-lg">✉️</span>
                  <span className="text-[11px] font-medium leading-tight">Envoyer un Email</span>
                </a>
              ) : null}
              {patient.phone && (
                <a href={`https://wa.me/${patient.phone.replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-emerald-600 dark:text-emerald-400">
                  <span className="text-lg">💬</span>
                  <span className="text-[11px] font-medium leading-tight">WhatsApp</span>
                </a>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            {patient.archived_at ? (
              <button onClick={handleUnarchive} disabled={archiveLoading}
                className="px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-sm font-medium transition-colors disabled:opacity-60">
                {archiveLoading ? "Chargement…" : "Désarchiver"}
              </button>
            ) : (
              <button onClick={handleArchiveStart} disabled={archiveLoading}
                className="px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm font-medium transition-colors disabled:opacity-60">
                {archiveLoading ? "Chargement…" : "Archiver"}
              </button>
            )}
            <div className="ms-auto">
              <button onClick={openEdit}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
                ✏️ Modifier
              </button>
            </div>
          </div>
        </div>
        {/* Section 3: History */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-5">Historique</h2>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <svg className="w-6 h-6 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Dossiers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    📁 Dossiers
                    <span className="text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{historyDossiers.length}</span>
                  </h3>
                  <button onClick={() => router.push(`/${locale}/dashboard/dossiers?new=1&patient_id=${patient.id}`)}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium">+ Nouveau</button>
                </div>
                {historyDossiers.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-4 text-center">Aucun dossier</p>
                ) : (
                  <div className="space-y-2">
                    {historyDossiers.map(d => (
                      <div key={d.id} onClick={() => router.push(`/${locale}/dashboard/dossiers/${d.id}`)}
                        className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-sm transition-all">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{d.title}</p>
                          <p className="text-xs text-zinc-400">{fmtDate(d.created_at)}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ms-2 ${d.statut === "termine" ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" : "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"}`}>
                          {d.statut === "termine" ? "Terminé" : "Ouvert"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Consultations */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                  🏥 Visites
                  <span className="text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                    {historyConsultations.length}
                  </span>
                </h3>
                {historyConsultations.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-4 text-center">Aucune visite</p>
                ) : (
                  <div className="space-y-3">
                    {historyConsultations.map(c => (
                      <div key={c.id} onClick={() => router.push(`/${locale}/dashboard/consultations/${c.id}`)}
                        className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-sm transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{c.motif}</span>
                          <span className="text-xs text-zinc-400">{fmtDate(c.exam_date)}</span>
                        </div>
                        {c.teeth && <p className="text-xs text-zinc-400 mb-1">Dents: {c.teeth}</p>}
                        {c.next_exam_date && <p className="text-xs text-zinc-400 mb-1">Prochain: {fmtDate(c.next_exam_date)}</p>}
                        {c.treated_by && <p className="text-xs text-zinc-400 mb-1">Dr. {c.treated_by}</p>}
                        {c.clinical_notes && <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700">{c.clinical_notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Factures */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                  🧾 Factures
                  <span className="text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                    {historyFactures.length}
                  </span>
                </h3>
                {historyFactures.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-4 text-center">Aucune facture</p>
                ) : (
                  <div className="space-y-2">
                    {historyFactures.map(f => (
                      <div key={f.id} onClick={() => router.push(`/${locale}/dashboard/factures/${f.id}`)}
                        className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-sm transition-all">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{fmtDate(f.created_at)}</p>
                          {f.notes && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{f.notes}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FACTURE_STATUS_STYLE[f.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                            {FACTURE_STATUS_LABEL[f.status] ?? f.status}
                          </span>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{f.total_price.toFixed(2)} MAD</p>
                            {f.deposit_paid > 0 && <p className="text-xs text-zinc-400">Ac: {f.deposit_paid.toFixed(2)} MAD</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>{/* end right column */}
      </div>{/* end grid */}

      {/* Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">{t("form.editTitle")}</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.firstName")} <span className="text-red-500">*</span></label>
                  <input {...field("first_name")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.lastName")} <span className="text-red-500">*</span></label>
                  <input {...field("last_name")} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.phone")}</label>
                  <input type="tel" {...field("phone")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.email")}</label>
                  <input type="email" {...field("email")} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.dob")}</label>
                <input type="date" {...field("date_of_birth")} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.address")}</label>
                <input {...field("address")} className={inputCls} />
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

      {/* Archive confirmation */}
      {archiveOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Archiver ce patient ?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {patient.first_name} {patient.last_name} et toutes ses données seront masquées :
            </p>
            {archivePreview && (
              <ul className="text-sm text-zinc-600 dark:text-zinc-300 mb-5 space-y-1">
                {archivePreview.consultations > 0 && <li>• {archivePreview.consultations} visite{archivePreview.consultations > 1 ? "s" : ""}</li>}
                {archivePreview.factures > 0 && <li>• {archivePreview.factures} facture{archivePreview.factures > 1 ? "s" : ""}</li>}
                {archivePreview.appointments > 0 && <li>• {archivePreview.appointments} rendez-vous</li>}
                {archivePreview.consultations === 0 && archivePreview.factures === 0 && archivePreview.appointments === 0 && (
                  <li className="text-zinc-400">Aucune donnée liée.</li>
                )}
              </ul>
            )}
            <p className="text-xs text-zinc-400 mb-5">Les données sont conservées et récupérables depuis les archives.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setArchiveOpen(false); setArchivePreview(null); }}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                Annuler
              </button>
              <button onClick={handleArchiveConfirm} disabled={archiveLoading}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                {archiveLoading ? "Archivage…" : "Archiver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
