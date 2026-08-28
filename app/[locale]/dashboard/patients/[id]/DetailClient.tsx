"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { Patient } from "@/types/database";
import { DR } from "@/components/DetailRow";
import { useAppContext } from "@/components/AppContext";

interface Props {
  patient: Patient;
  locale: string;
}

type HistoryDossier = {
  id: string; type: string; exam_date: string;
  next_exam_date: string | null; treated_by: string | null; dental_notes: string | null;
};

type HistoryFacture = {
  id: string; status: string; total_price: number;
  deposit_paid: number; created_at: string; notes: string | null;
};

type FactureItem = {
  id: string; description: string; quantity: number; unit_price: number;
};

type DetailSnapshot = {
  lastDossier: { id: string; exam_date: string; type: string } | null;
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

const DOSSIER_TYPE_STYLE: Record<string, string> = {
  examen:  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  soin:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  bilan:   "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  urgence: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  autre:   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const FACTURE_STATUSES = ["en_attente", "en_cours", "payee", "annulee"] as const;

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
  const supabase = createClient();
  const router = useRouter();
  const { shopName, shopAddress, shopPhone, logoUrl, practiceId, currentUserId } = useAppContext();

  const [patient, setPatient] = useState<Patient>(initialPatient);
  const [isMobile, setIsMobile] = useState(false);

  // Snapshot
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DetailSnapshot | null>(null);

  // History
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyDossiers, setHistoryDossiers] = useState<HistoryDossier[]>([]);
  const [historyFactures, setHistoryFactures] = useState<HistoryFacture[]>([]);

  // History sub-modals
  const [selectedDossier, setSelectedDossier] = useState<HistoryDossier | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<HistoryFacture | null>(null);
  const [selectedFactureItems, setSelectedFactureItems] = useState<FactureItem[]>([]);
  const [selectedFactureItemsLoading, setSelectedFactureItemsLoading] = useState(false);
  const [historyDeleteConfirm, setHistoryDeleteConfirm] = useState<{ type: "dossier" | "facture"; id: string } | null>(null);

  // Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Archive
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePreview, setArchivePreview] = useState<{ dossiers: number; factures: number; appointments: number } | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const now = new Date().toISOString();
    Promise.all([
      supabase.from("dossiers").select("id, exam_date, type").eq("patient_id", patient.id).order("exam_date", { ascending: false }).limit(1),
      supabase.from("appointments").select("id, title, scheduled_at").eq("patient_id", patient.id).eq("status", "planifie").gte("scheduled_at", now).order("scheduled_at", { ascending: true }).limit(1),
      supabase.from("factures").select("id, status, total_price, deposit_paid").eq("patient_id", patient.id).in("status", ["en_attente", "en_cours"]),
    ]).then(([{ data: dossier }, { data: appt }, { data: factures }]) => {
      setSnapshot({
        lastDossier: dossier?.[0] ?? null,
        nextAppointment: appt?.[0] ?? null,
        activeFactures: (factures ?? []) as { id: string; status: string; total_price: number; deposit_paid: number }[],
      });
      setSnapshotLoading(false);
    });
  }, [patient.id]);

  useEffect(() => {
    Promise.all([
      supabase.from("dossiers").select("id, type, exam_date, next_exam_date, treated_by, dental_notes").eq("patient_id", patient.id).order("exam_date", { ascending: false }),
      supabase.from("factures").select("id, status, total_price, deposit_paid, created_at, notes").eq("patient_id", patient.id).order("created_at", { ascending: false }),
    ]).then(([{ data: dossiers }, { data: factures }]) => {
      setHistoryDossiers((dossiers ?? []) as HistoryDossier[]);
      setHistoryFactures((factures ?? []) as HistoryFacture[]);
      setHistoryLoading(false);
    });
  }, [patient.id]);

  async function openFactureDetail(f: HistoryFacture) {
    setSelectedFacture(f);
    setSelectedFactureItemsLoading(true);
    setSelectedFactureItems([]);
    const { data } = await supabase.from("facture_items").select("id, description, quantity, unit_price").eq("facture_id", f.id).order("id");
    setSelectedFactureItems((data ?? []) as FactureItem[]);
    setSelectedFactureItemsLoading(false);
  }

  async function handleHistoryDossierDelete() {
    if (!historyDeleteConfirm || !selectedDossier) return;
    await supabase.from("dossiers").delete().eq("id", historyDeleteConfirm.id);
    setHistoryDossiers(ds => ds.filter(d => d.id !== historyDeleteConfirm.id));
    setHistoryDeleteConfirm(null);
    setSelectedDossier(null);
  }

  async function handleHistoryFactureDelete() {
    if (!historyDeleteConfirm || !selectedFacture) return;
    await supabase.from("factures").delete().eq("id", historyDeleteConfirm.id);
    setHistoryFactures(fs => fs.filter(f => f.id !== historyDeleteConfirm.id));
    setHistoryDeleteConfirm(null);
    setSelectedFacture(null);
  }

  async function handleHistoryFactureStatusChange(newStatus: string) {
    if (!selectedFacture) return;
    await supabase.from("factures").update({ status: newStatus }).eq("id", selectedFacture.id);
    const updated = { ...selectedFacture, status: newStatus };
    setSelectedFacture(updated);
    setHistoryFactures(fs => fs.map(f => f.id === updated.id ? updated : f));
  }

  async function exportHistoryFacturePdf() {
    if (!selectedFacture) return;
    const { exportFacturePdf } = await import("@/utils/pdf-export");
    exportFacturePdf({
      factureId: selectedFacture.id,
      patientName: `${patient.first_name} ${patient.last_name}`,
      patientPhone: patient.phone ?? null,
      patientAddress: null,
      createdAt: selectedFacture.created_at,
      statusLabel: FACTURE_STATUS_LABEL[selectedFacture.status] ?? selectedFacture.status,
      items: selectedFactureItems.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })),
      totalPrice: selectedFacture.total_price,
      depositPaid: selectedFacture.deposit_paid,
      notes: selectedFacture.notes,
      shopName, shopAddress, shopPhone, logoUrl,
    });
  }

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
      supabase.from("dossiers").select("*", { count: "exact", head: true }).eq("patient_id", patient.id).is("archived_at", null),
      supabase.from("factures").select("*", { count: "exact", head: true }).eq("patient_id", patient.id).is("archived_at", null),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("patient_id", patient.id).is("archived_at", null),
    ]);
    setArchivePreview({ dossiers: dCount ?? 0, factures: fCount ?? 0, appointments: aCount ?? 0 });
    setArchiveLoading(false);
    setArchiveOpen(true);
  }

  async function handleArchiveConfirm() {
    setArchiveLoading(true);
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from("patients").update({ archived_at: now }).eq("id", patient.id),
      supabase.from("dossiers").update({ archived_at: now }).eq("patient_id", patient.id),
      supabase.from("factures").update({ archived_at: now }).eq("patient_id", patient.id),
      supabase.from("appointments").update({ archived_at: now }).eq("patient_id", patient.id),
    ]);
    setArchiveLoading(false);
    router.push(`/${locale}/dashboard/patients`);
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
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{patient.first_name} {patient.last_name}</h1>
            <p className="text-sm text-zinc-400">Ajouté le {fmtDate(patient.created_at)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Section 1: Contact info */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">Informations</h2>
          <div className="space-y-1">
            <DR label={t("columns.phone")} value={patient.phone} />
            <DR label={t("columns.email")} value={patient.email} />
            <DR label={t("columns.dob")} value={fmtDate(patient.date_of_birth)} />
            <DR label="Adresse" value={patient.address} />
            <DR label="Notes" value={patient.notes} />
          </div>
        </div>

        {/* Section 2: Vue rapide + Quick actions */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">Vue rapide</h2>
          {snapshotLoading ? (
            <div className="flex justify-center py-4">
              <svg className="w-5 h-5 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : (
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">🗂️</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Dernier dossier</p>
                    <p className="text-[11px] text-zinc-400">
                      {snapshot?.lastDossier
                        ? `${fmtDate(snapshot.lastDossier.exam_date)} · ${snapshot.lastDossier.type}`
                        : "Aucun"}
                    </p>
                  </div>
                </div>
                {snapshot?.lastDossier && (
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/dossiers/${snapshot.lastDossier!.id}`)}
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
                    onClick={() => router.push(`/${locale}/dashboard/appointments`)}
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-medium shrink-0 ms-2">
                    Voir →
                  </button>
                )}
              </div>
              {snapshot && snapshot.activeFactures.length > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🧾</span>
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        {snapshot.activeFactures.length} facture{snapshot.activeFactures.length > 1 ? "s" : ""} non soldée{snapshot.activeFactures.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => router.push(`/${locale}/dashboard/factures`)}
                      className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-medium">
                      Voir →
                    </button>
                  </div>
                  {snapshot.activeFactures.map(f => (
                    <div key={f.id} className="flex items-center justify-between">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${FACTURE_STATUS_STYLE[f.status]}`}>
                        {FACTURE_STATUS_LABEL[f.status]}
                      </span>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                        {(f.total_price - f.deposit_paid).toFixed(2)} MAD dû
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Actions rapides</h2>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <button onClick={() => router.push(`/${locale}/dashboard/factures?new=1&patient_id=${patient.id}`)}
              className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-teal-600 dark:text-teal-400">
              <span className="text-lg">🧾</span>
              <span className="text-[11px] font-medium leading-tight">Facture</span>
            </button>
            <button onClick={() => router.push(`/${locale}/dashboard/dossiers?new=1&patient_id=${patient.id}`)}
              className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-teal-600 dark:text-teal-400">
              <span className="text-lg">🗂️</span>
              <span className="text-[11px] font-medium leading-tight">Dossier</span>
            </button>
            <button onClick={() => router.push(`/${locale}/dashboard/appointments?new=1&patient_id=${patient.id}`)}
              className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-teal-600 dark:text-teal-400">
              <span className="text-lg">📅</span>
              <span className="text-[11px] font-medium leading-tight">RDV</span>
            </button>
          </div>
          {(patient.phone || (!isMobile && patient.email)) && (
            <div className={`grid gap-2 ${patient.phone && (!isMobile ? patient.email : true) ? "grid-cols-2" : "grid-cols-1"}`}>
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
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                  🗂️ Dossiers
                  <span className="text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                    {historyDossiers.length}
                  </span>
                </h3>
                {historyDossiers.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-4 text-center">Aucun dossier</p>
                ) : (
                  <div className="space-y-3">
                    {historyDossiers.map(d => (
                      <div key={d.id} onClick={() => setSelectedDossier(d)}
                        className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-sm transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{d.type}</span>
                          <span className="text-xs text-zinc-400">{fmtDate(d.exam_date)}</span>
                        </div>
                        {d.next_exam_date && <p className="text-xs text-zinc-400 mb-1">Prochain: {fmtDate(d.next_exam_date)}</p>}
                        {d.treated_by && <p className="text-xs text-zinc-400 mb-1">Dr. {d.treated_by}</p>}
                        {d.dental_notes && <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700">{d.dental_notes}</p>}
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
                      <div key={f.id} onClick={() => openFactureDetail(f)}
                        className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-sm transition-all">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{fmtDate(f.created_at)}</p>
                          {f.notes && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{f.notes}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FACTURE_STATUS_STYLE[f.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                            {f.status}
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

        {/* Bottom action bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 pb-8">
          <button onClick={handleArchiveStart} disabled={archiveLoading}
            className="px-4 py-2 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm font-medium transition-colors disabled:opacity-60">
            Archiver
          </button>
          <div className="ms-auto">
            <button onClick={openEdit}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
              ✏️ Modifier
            </button>
          </div>
        </div>
      </div>

      {/* Dossier detail sub-modal */}
      {selectedDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedDossier(null)}>
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-lg">🦷</div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{patient.first_name} {patient.last_name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOSSIER_TYPE_STYLE[selectedDossier.type] ?? DOSSIER_TYPE_STYLE.autre}`}>
                    {selectedDossier.type}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedDossier(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-1">
              <DR label="Date d'examen" value={fmtDate(selectedDossier.exam_date)} />
              <DR label="Prochain contrôle" value={fmtDate(selectedDossier.next_exam_date)} />
              <DR label="Traité par" value={selectedDossier.treated_by ? `Dr. ${selectedDossier.treated_by}` : null} />
              <DR label="Notes cliniques" value={selectedDossier.dental_notes} />
            </div>
            <div className="flex items-center gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => setHistoryDeleteConfirm({ type: "dossier", id: selectedDossier.id })}
                className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                Supprimer
              </button>
              <div className="ms-auto">
                <button onClick={() => { setSelectedDossier(null); router.push(`/${locale}/dashboard/dossiers/${selectedDossier.id}`); }}
                  className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
                  ✏️ Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Facture detail sub-modal */}
      {selectedFacture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedFacture(null)}>
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-lg">🧾</div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{patient.first_name} {patient.last_name}</h2>
                  <p className="text-xs text-zinc-400">{fmtDate(selectedFacture.created_at)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedFacture(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 w-24 shrink-0">Statut</span>
                <select value={selectedFacture.status} onChange={e => handleHistoryFactureStatusChange(e.target.value)}
                  className={`flex-1 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 ${FACTURE_STATUS_STYLE[selectedFacture.status] ?? ""}`}>
                  {FACTURE_STATUSES.map(s => <option key={s} value={s}>{FACTURE_STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <DR label="Total" value={`${selectedFacture.total_price.toFixed(2)} MAD`} />
              <DR label="Acompte versé" value={`${selectedFacture.deposit_paid.toFixed(2)} MAD`} />
              <DR label="Reste à payer" value={`${(selectedFacture.total_price - selectedFacture.deposit_paid).toFixed(2)} MAD`} />
              <DR label="Notes" value={selectedFacture.notes} />
              <div className="pt-2">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Lignes de facture</p>
                {selectedFactureItemsLoading ? (
                  <div className="flex justify-center py-6">
                    <svg className="w-6 h-6 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                ) : selectedFactureItems.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-4">Aucune ligne</p>
                ) : (
                  <div className="space-y-2">
                    {selectedFactureItems.map(item => (
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
              <button onClick={() => setHistoryDeleteConfirm({ type: "facture", id: selectedFacture.id })}
                className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                Supprimer
              </button>
              <div className="ms-auto flex items-center gap-2">
                <button onClick={exportHistoryFacturePdf}
                  className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors">
                  🖨️ PDF
                </button>
                <button onClick={() => { setSelectedFacture(null); router.push(`/${locale}/dashboard/factures/${selectedFacture.id}`); }}
                  className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
                  ✏️ Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History delete confirmation */}
      {historyDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Confirmer la suppression</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setHistoryDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Annuler
              </button>
              <button onClick={historyDeleteConfirm.type === "dossier" ? handleHistoryDossierDelete : handleHistoryFactureDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

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
                {archivePreview.dossiers > 0 && <li>• {archivePreview.dossiers} dossier{archivePreview.dossiers > 1 ? "s" : ""}</li>}
                {archivePreview.factures > 0 && <li>• {archivePreview.factures} facture{archivePreview.factures > 1 ? "s" : ""}</li>}
                {archivePreview.appointments > 0 && <li>• {archivePreview.appointments} rendez-vous</li>}
                {archivePreview.dossiers === 0 && archivePreview.factures === 0 && archivePreview.appointments === 0 && (
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
