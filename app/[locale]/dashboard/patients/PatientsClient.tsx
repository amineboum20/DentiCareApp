"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { Patient } from "@/types/database";
import { DR } from "@/components/DetailRow";
import { useAppContext } from "@/components/AppContext";

interface Props {
  initialPatients: Patient[];
}

const emptyForm = {
  first_name: "", last_name: "", email: "",
  phone: "", date_of_birth: "", address: "", notes: "",
};

type HistoryDossier = {
  id: string;
  type: string;
  exam_date: string;
  next_exam_date: string | null;
  treated_by: string | null;
  dental_notes: string | null;
};

type HistoryFacture = {
  id: string;
  status: string;
  total_price: number;
  deposit_paid: number;
  created_at: string;
  notes: string | null;
};

type FactureItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
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

export default function PatientsClient({ initialPatients }: Props) {
  const t = useTranslations("patients");
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const { shopName, shopAddress, shopPhone, logoUrl, practiceId, currentUserId } = useAppContext();
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [archiveTarget, setArchiveTarget] = useState<Patient | null>(null);
  const [archivePreview, setArchivePreview] = useState<{ dossiers: number; factures: number; appointments: number } | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState<Patient | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    const found = patients.find((c) => c.id === id);
    if (found) openDetail(found);
  }, [searchParams]);

  // History panel
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDossiers, setHistoryDossiers] = useState<HistoryDossier[]>([]);
  const [historyFactures, setHistoryFactures] = useState<HistoryFacture[]>([]);

  // Detail modals from history
  const [selectedDossier, setSelectedDossier] = useState<HistoryDossier | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<HistoryFacture | null>(null);
  const [selectedFactureItems, setSelectedFactureItems] = useState<FactureItem[]>([]);
  const [selectedFactureItemsLoading, setSelectedFactureItemsLoading] = useState(false);
  const [historyDeleteConfirm, setHistoryDeleteConfirm] = useState<{ type: "dossier" | "facture"; id: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSnapshot, setDetailSnapshot] = useState<DetailSnapshot | null>(null);

  const filtered = useMemo(() =>
    patients.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.email ?? ""} ${c.phone ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ),
    [patients, search]
  );

  function openAdd() {
    setEditingPatient(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(c: Patient) {
    setEditingPatient(c);
    setForm({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      date_of_birth: c.date_of_birth ?? "",
      address: c.address ?? "",
      notes: c.notes ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function openHistory(c: Patient) {
    setHistoryPatient(c);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryDossiers([]);
    setHistoryFactures([]);
    const [{ data: dossiers }, { data: factures }] = await Promise.all([
      supabase.from("dossiers").select("id, type, exam_date, next_exam_date, treated_by, dental_notes")
        .eq("patient_id", c.id).order("exam_date", { ascending: false }),
      supabase.from("factures").select("id, status, total_price, deposit_paid, created_at, notes")
        .eq("patient_id", c.id).order("created_at", { ascending: false }),
    ]);
    setHistoryDossiers((dossiers ?? []) as HistoryDossier[]);
    setHistoryFactures((factures ?? []) as HistoryFacture[]);
    setHistoryLoading(false);
  }

  async function openFactureDetail(f: HistoryFacture) {
    setSelectedFacture(f);
    setSelectedFactureItemsLoading(true);
    setSelectedFactureItems([]);
    const { data } = await supabase
      .from("facture_items")
      .select("id, description, quantity, unit_price")
      .eq("facture_id", f.id)
      .order("id");
    setSelectedFactureItems((data ?? []) as FactureItem[]);
    setSelectedFactureItemsLoading(false);
  }

  async function handleHistoryDossierDelete() {
    if (!historyDeleteConfirm || !selectedDossier) return;
    await supabase.from("dossiers").delete().eq("id", historyDeleteConfirm.id);
    setHistoryDossiers((ds) => ds.filter((d) => d.id !== historyDeleteConfirm.id));
    setHistoryDeleteConfirm(null);
    setSelectedDossier(null);
  }

  async function handleHistoryFactureDelete() {
    if (!historyDeleteConfirm || !selectedFacture) return;
    await supabase.from("factures").delete().eq("id", historyDeleteConfirm.id);
    setHistoryFactures((fs) => fs.filter((f) => f.id !== historyDeleteConfirm.id));
    setHistoryDeleteConfirm(null);
    setSelectedFacture(null);
  }

  async function handleHistoryFactureStatusChange(newStatus: string) {
    if (!selectedFacture) return;
    await supabase.from("factures").update({ status: newStatus }).eq("id", selectedFacture.id);
    const updated = { ...selectedFacture, status: newStatus };
    setSelectedFacture(updated);
    setHistoryFactures((fs) => fs.map((f) => (f.id === updated.id ? updated : f)));
  }

  async function exportHistoryFacturePdf() {
    if (!selectedFacture) return;
    const { exportFacturePdf } = await import("@/utils/pdf-export");
    exportFacturePdf({
      factureId:     selectedFacture.id,
      patientName:   historyPatient ? `${historyPatient.first_name} ${historyPatient.last_name}` : "—",
      patientPhone:  historyPatient?.phone ?? null,
      patientAddress: null,
      createdAt:     selectedFacture.created_at,
      statusLabel:   FACTURE_STATUS_LABEL[selectedFacture.status] ?? selectedFacture.status,
      items:         selectedFactureItems.map((i) => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })),
      totalPrice:    selectedFacture.total_price,
      depositPaid:   selectedFacture.deposit_paid,
      notes:         selectedFacture.notes,
      shopName,
      shopAddress,
      shopPhone,
      logoUrl,
    });
  }

  async function openDetail(c: Patient) {
    setDetail(c);
    setDetailLoading(true);
    setDetailSnapshot(null);
    const now = new Date().toISOString();
    const [{ data: dossier }, { data: appt }, { data: factures }] = await Promise.all([
      supabase.from("dossiers")
        .select("id, exam_date, type")
        .eq("patient_id", c.id)
        .order("exam_date", { ascending: false })
        .limit(1),
      supabase.from("appointments")
        .select("id, title, scheduled_at")
        .eq("patient_id", c.id)
        .eq("status", "planifie")
        .gte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(1),
      supabase.from("factures")
        .select("id, status, total_price, deposit_paid")
        .eq("patient_id", c.id)
        .in("status", ["en_attente", "en_cours"]),
    ]);
    setDetailSnapshot({
      lastDossier: dossier?.[0] ?? null,
      nextAppointment: appt?.[0] ?? null,
      activeFactures: (factures ?? []) as { id: string; status: string; total_price: number; deposit_paid: number }[],
    });
    setDetailLoading(false);
  }

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError(t("form.requiredError"));
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editingPatient) {
      const { data, error: err } = await supabase
        .from("patients")
        .update(payload)
        .eq("id", editingPatient.id)
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setPatients((cs) => cs.map((c) => (c.id === data.id ? (data as Patient) : c)));
    } else {
      const { data, error: err } = await supabase
        .from("patients")
        .insert({ ...payload, practice_id: practiceId, created_by: currentUserId })
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setPatients((cs) => [data as Patient, ...cs]);
    }

    setSaving(false);
    setModalOpen(false);
  }

  async function handleArchiveStart(patient: Patient) {
    setArchiveLoading(true);
    const [{ count: dCount }, { count: fCount }, { count: aCount }] = await Promise.all([
      supabase.from("dossiers").select("*", { count: "exact", head: true }).eq("patient_id", patient.id).is("archived_at", null),
      supabase.from("factures").select("*", { count: "exact", head: true }).eq("patient_id", patient.id).is("archived_at", null),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("patient_id", patient.id).is("archived_at", null),
    ]);
    setArchiveTarget(patient);
    setArchivePreview({ dossiers: dCount ?? 0, factures: fCount ?? 0, appointments: aCount ?? 0 });
    setArchiveLoading(false);
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from("patients").update({ archived_at: now }).eq("id", archiveTarget.id),
      supabase.from("dossiers").update({ archived_at: now }).eq("patient_id", archiveTarget.id),
      supabase.from("factures").update({ archived_at: now }).eq("patient_id", archiveTarget.id),
      supabase.from("appointments").update({ archived_at: now }).eq("patient_id", archiveTarget.id),
    ]);
    setPatients((prev) => prev.filter((p) => p.id !== archiveTarget.id));
    setArchiveTarget(null);
    setArchivePreview(null);
    setArchiveLoading(false);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
          + {t("newPatient")}
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
            <span className="text-4xl mb-3">{search ? "🔍" : "🦷"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {search ? t("noResults") : t("noPatients")}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {search ? t("noResultsDesc", { query: search }) : t("noClientsDesc")}
            </p>
            {!search && (
              <button onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium">
                + {t("newPatient")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.name")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.phone")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.email")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.dob")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.added")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}
                  onClick={() => openDetail(c)}
                  className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{c.phone ?? "—"}</td>
                  <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{c.email ?? "—"}</td>
                  <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{fmtDate(c.date_of_birth)}</td>
                  <td className="px-5 py-3.5 text-zinc-400">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setDetail(null)}>
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 dark:text-teal-400 text-lg font-bold">
                  {detail.first_name[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{detail.first_name} {detail.last_name}</h2>
                  <p className="text-xs text-zinc-400">{t("columns.added")}: {fmtDate(detail.created_at)}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-1">
              <DR label={t("columns.phone")} value={detail.phone} />
              <DR label={t("columns.email")} value={detail.email} />
              <DR label={t("columns.dob")} value={fmtDate(detail.date_of_birth)} />
              <DR label="Adresse" value={detail.address} />
              <DR label="Notes" value={detail.notes} />
            </div>
            {/* Vue rapide */}
            <div className="px-6 pt-4 pb-3 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2.5">Vue rapide</p>
              {detailLoading ? (
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
                      <span className="text-sm shrink-0">🗂️</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Dernier dossier</p>
                        <p className="text-[11px] text-zinc-400">
                          {detailSnapshot?.lastDossier
                            ? `${fmtDate(detailSnapshot.lastDossier.exam_date)} · ${detailSnapshot.lastDossier.type}`
                            : "Aucun"}
                        </p>
                      </div>
                    </div>
                    {detailSnapshot?.lastDossier && (
                      <button
                        onClick={() => { setDetail(null); router.push(`/${locale}/dashboard/dossiers?detail=${detailSnapshot.lastDossier!.id}`); }}
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
                          {detailSnapshot?.nextAppointment
                            ? fmtDateTime(detailSnapshot.nextAppointment.scheduled_at)
                            : "Aucun planifié"}
                        </p>
                      </div>
                    </div>
                    {detailSnapshot?.nextAppointment && (
                      <button
                        onClick={() => { setDetail(null); router.push(`/${locale}/dashboard/appointments`); }}
                        className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-medium shrink-0 ms-2">
                        Voir →
                      </button>
                    )}
                  </div>
                  {detailSnapshot && detailSnapshot.activeFactures.length > 0 && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 px-3 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🧾</span>
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                            {detailSnapshot.activeFactures.length} facture{detailSnapshot.activeFactures.length > 1 ? "s" : ""} non soldée{detailSnapshot.activeFactures.length > 1 ? "s" : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => { setDetail(null); router.push(`/${locale}/dashboard/factures`); }}
                          className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-medium">
                          Voir →
                        </button>
                      </div>
                      {detailSnapshot.activeFactures.map((f) => (
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
            </div>
            {/* Quick actions */}
            <div className="px-6 pb-3">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Actions rapides</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <button onClick={() => { setDetail(null); router.push(`/${locale}/dashboard/factures?new=1&patient_id=${detail.id}`); }}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-teal-600 dark:text-teal-400">
                  <span className="text-lg">🧾</span>
                  <span className="text-[11px] font-medium leading-tight">Facture</span>
                </button>
                <button onClick={() => { setDetail(null); router.push(`/${locale}/dashboard/dossiers?new=1&patient_id=${detail.id}`); }}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-teal-600 dark:text-teal-400">
                  <span className="text-lg">🗂️</span>
                  <span className="text-[11px] font-medium leading-tight">Dossier</span>
                </button>
                <button onClick={() => { setDetail(null); router.push(`/${locale}/dashboard/appointments?new=1&patient_id=${detail.id}`); }}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-teal-600 dark:text-teal-400">
                  <span className="text-lg">📅</span>
                  <span className="text-[11px] font-medium leading-tight">RDV</span>
                </button>
              </div>
              {(detail.phone || (!isMobile && detail.email)) && (
                <div className={`grid gap-2 ${detail.phone && (!isMobile ? detail.email : true) ? "grid-cols-2" : "grid-cols-1"}`}>
                  {isMobile && detail.phone ? (
                    <a href={`tel:${detail.phone.replace(/\D/g, "")}`}
                      className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-300">
                      <span className="text-lg">📞</span>
                      <span className="text-[11px] font-medium leading-tight">Appeler</span>
                    </a>
                  ) : !isMobile && detail.email ? (
                    <a href={`mailto:${detail.email}`}
                      className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-300">
                      <span className="text-lg">✉️</span>
                      <span className="text-[11px] font-medium leading-tight">Envoyer un Email</span>
                    </a>
                  ) : null}
                  {detail.phone && (
                    <a href={`https://wa.me/${detail.phone.replace(/\D/g, "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-emerald-600 dark:text-emerald-400">
                      <span className="text-lg">💬</span>
                      <span className="text-[11px] font-medium leading-tight">WhatsApp</span>
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => { handleArchiveStart(detail); setDetail(null); }}
                className="px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm font-medium transition-colors"
              >
                Archiver
              </button>
              <div className="ms-auto flex flex-wrap items-center gap-2">
                <button onClick={() => { openHistory(detail); setDetail(null); }}
                  className="px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 text-sm font-medium transition-colors">
                  📋 Historique
                </button>
                <button onClick={() => { openEdit(detail); setDetail(null); }}
                  className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
                  ✏️ Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History slide-over */}
      {historyOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setHistoryOpen(false)}
          />
          <div className="fixed inset-y-0 end-0 z-50 w-full max-w-xl bg-white dark:bg-zinc-900 shadow-2xl flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-white">
                  {historyPatient ? `${historyPatient.first_name} ${historyPatient.last_name}` : ""}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">{t("history.subtitle")}</p>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="3" x2="15" y2="15" /><line x1="15" y1="3" x2="3" y2="15" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
              {historyLoading ? (
                <div className="flex items-center justify-center py-20">
                  <svg className="w-8 h-8 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
              ) : (
                <>
                  {/* Dossiers */}
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                      🗂️ {t("history.dossiers")}
                      <span className="text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                        {historyDossiers.length}
                      </span>
                    </h3>
                    {historyDossiers.length === 0 ? (
                      <p className="text-sm text-zinc-400 py-4 text-center">{t("history.noDossiers")}</p>
                    ) : (
                      <div className="space-y-3">
                        {historyDossiers.map((d) => (
                          <div key={d.id}
                            onClick={() => setSelectedDossier(d)}
                            className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-sm transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                {d.type}
                              </span>
                              <span className="text-xs text-zinc-400">{fmtDate(d.exam_date)}</span>
                            </div>
                            {d.next_exam_date && (
                              <p className="text-xs text-zinc-400 mb-1">Prochain: {fmtDate(d.next_exam_date)}</p>
                            )}
                            {d.treated_by && (
                              <p className="text-xs text-zinc-400 mb-1">Dr. {d.treated_by}</p>
                            )}
                            {d.dental_notes && (
                              <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700">{d.dental_notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Factures */}
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                      🧾 {t("history.factures")}
                      <span className="text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                        {historyFactures.length}
                      </span>
                    </h3>
                    {historyFactures.length === 0 ? (
                      <p className="text-sm text-zinc-400 py-4 text-center">{t("history.noFactures")}</p>
                    ) : (
                      <div className="space-y-2">
                        {historyFactures.map((f) => (
                          <div key={f.id}
                            onClick={() => openFactureDetail(f)}
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
                                {f.deposit_paid > 0 && (
                                  <p className="text-xs text-zinc-400">Ac: {f.deposit_paid.toFixed(2)} MAD</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Dossier detail modal (from history) */}
      {selectedDossier && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedDossier(null)}>
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-lg">🦷</div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">
                    {historyPatient ? `${historyPatient.first_name} ${historyPatient.last_name}` : ""}
                  </h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOSSIER_TYPE_STYLE[selectedDossier.type] ?? DOSSIER_TYPE_STYLE.autre}`}>
                    {selectedDossier.type}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedDossier(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-1">
              <DR label="Date d'examen" value={fmtDate(selectedDossier.exam_date)} />
              <DR label="Prochain contrôle" value={fmtDate(selectedDossier.next_exam_date)} />
              <DR label="Traité par" value={selectedDossier.treated_by ? `Dr. ${selectedDossier.treated_by}` : null} />
              <DR label="Notes cliniques" value={selectedDossier.dental_notes} />
            </div>
            <div className="flex items-center gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setHistoryDeleteConfirm({ type: "dossier", id: selectedDossier.id })}
                className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                Supprimer
              </button>
              <div className="ms-auto">
                <button
                  onClick={() => { setSelectedDossier(null); router.push(`/${locale}/dashboard/dossiers?detail=${selectedDossier.id}`); }}
                  className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
                  ✏️ Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Facture detail modal (from history) */}
      {selectedFacture && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedFacture(null)}>
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-lg">🧾</div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">
                    {historyPatient ? `${historyPatient.first_name} ${historyPatient.last_name}` : ""}
                  </h2>
                  <p className="text-xs text-zinc-400">{fmtDate(selectedFacture.created_at)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedFacture(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {/* Inline status change */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 w-24 shrink-0">Statut</span>
                <select
                  value={selectedFacture.status}
                  onChange={(e) => handleHistoryFactureStatusChange(e.target.value)}
                  className={`flex-1 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 ${FACTURE_STATUS_STYLE[selectedFacture.status] ?? ""}`}>
                  {FACTURE_STATUSES.map((s) => (
                    <option key={s} value={s}>{FACTURE_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <DR label="Total" value={`${selectedFacture.total_price.toFixed(2)} MAD`} />
              <DR label="Acompte versé" value={`${selectedFacture.deposit_paid.toFixed(2)} MAD`} />
              <DR label="Reste à payer" value={`${(selectedFacture.total_price - selectedFacture.deposit_paid).toFixed(2)} MAD`} />
              <DR label="Notes" value={selectedFacture.notes} />
              {/* Items */}
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
                    {selectedFactureItems.map((item) => (
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
              <button
                onClick={() => setHistoryDeleteConfirm({ type: "facture", id: selectedFacture.id })}
                className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                Supprimer
              </button>
              <div className="ms-auto flex items-center gap-2">
                <button
                  onClick={exportHistoryFacturePdf}
                  className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors">
                  🖨️ PDF
                </button>
                <button
                  onClick={() => { setSelectedFacture(null); router.push(`/${locale}/dashboard/factures?detail=${selectedFacture.id}`); }}
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Confirmer la suppression</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setHistoryDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Annuler
              </button>
              <button
                onClick={historyDeleteConfirm.type === "dossier" ? handleHistoryDossierDelete : handleHistoryFactureDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                {editingPatient ? t("form.editTitle") : t("form.addTitle")}
              </h2>
              <button onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.firstName")} <span className="text-red-500">*</span>
                  </label>
                  <input {...field("first_name")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.lastName")} <span className="text-red-500">*</span>
                  </label>
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

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editingPatient && (
                <button type="button" onClick={() => { handleArchiveStart(editingPatient); setModalOpen(false); }}
                  className="px-4 py-2 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm font-medium transition-colors">
                  Archiver
                </button>
              )}
              <div className="ms-auto flex items-center gap-3">
                <button onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  {t("form.cancel")}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                  {saving ? t("form.saving") : t("form.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      {archiveTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Archiver ce patient ?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {archiveTarget.first_name} {archiveTarget.last_name} et toutes ses données seront masquées :
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
              <button onClick={() => { setArchiveTarget(null); setArchivePreview(null); }}
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
