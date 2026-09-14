"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { ConsultationWithPatient, ConsultationMotif, ActeScope } from "@/types/database";
import { DR } from "@/components/DetailRow";
import { PraticienSelect } from "@/components/PraticienSelect";
import LocalInstant from "@/components/LocalInstant";
import { useAppContext } from "@/components/AppContext";
import { billActesToDossier } from "@/utils/billing";
import ToothPicker from "@/components/ToothPicker";
import AuditInfo from "@/components/AuditInfo";

interface Props {
  consultation: ConsultationWithPatient & { dossiers?: { id: string; title: string; statut: string } | { id: string; title: string; statut: string }[] | null };
  originRdv: { id: string; scheduled_at: string; title: string } | null;
  facturation: { facture: number; paye: number; reste: number } | null;
  locale: string;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

// Like DR but always renders (empty shows "—"), so the clinical structure stays visible.
function AlwaysRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 py-0.5">
      <span className="text-xs text-zinc-400 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{value && value.trim() ? value : "—"}</span>
    </div>
  );
}

const MOTIF_STYLE: Record<string, string> = {
  consultation: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  controle:     "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  soin:         "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  urgence:      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  autre:        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const MOTIFS: ConsultationMotif[] = ["consultation", "controle", "soin", "urgence", "autre"];

const emptyForm = {
  motif: "consultation" as ConsultationMotif,
  exam_date: "", next_exam_date: "", treated_by: "", praticien_id: "", teeth: "", clinical_notes: "", exams: "",
};

export default function ConsultationDetailClient({ consultation: initialConsultation, originRdv, facturation, locale }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const t = useTranslations("visites");
  const tc = useTranslations("common");
  const { practiceId, currentUserId } = useAppContext();

  const dossierRel = initialConsultation.dossiers;
  const dossier = Array.isArray(dossierRel) ? (dossierRel[0] ?? null) : (dossierRel ?? null);

  const [ordonnances, setOrdonnances] = useState<{ id: string; date: string; prescriber: string | null }[]>([]);
  useEffect(() => {
    supabase.from("ordonnances").select("id, date, prescriber").eq("consultation_id", initialConsultation.id).is("archived_at", null).order("date", { ascending: false })
      .then(({ data }) => setOrdonnances((data ?? []) as { id: string; date: string; prescriber: string | null }[]));
  }, [initialConsultation.id, supabase]);

  // Actes billed for this visite (its dossier's facture lines stamped with the exam date).
  const [acteItems, setActeItems] = useState<{ id: string; description: string; quantity: number; unit_price: number; teeth: string[] | null }[]>([]);
  useEffect(() => {
    const dId = Array.isArray(initialConsultation.dossiers) ? initialConsultation.dossiers[0]?.id : initialConsultation.dossiers?.id;
    if (!dId) return;
    supabase.from("facture_items")
      .select("id, description, quantity, unit_price, teeth, factures!inner(dossier_id)")
      .eq("factures.dossier_id", dId)
      .eq("acte_date", initialConsultation.exam_date)
      .then(({ data }) => setActeItems((data ?? []) as unknown as { id: string; description: string; quantity: number; unit_price: number; teeth: string[] | null }[]));
  }, [initialConsultation.dossiers, initialConsultation.exam_date, supabase]);

  // Acte catalogue + extra actes to append on edit (only newly-added ones are billed).
  const [actesCatalog, setActesCatalog] = useState<{ id: string; name: string; price: number; scope: ActeScope; category: string; tooth_status: string | null }[]>([]);
  const [billExtra, setBillExtra] = useState<{ id: string; name: string; price: number; scope?: ActeScope; teeth?: string[]; category?: string; tooth_status?: string | null }[]>([]);
  useEffect(() => {
    supabase.from("actes").select("id, name, price, scope, category, tooth_status").order("name")
      .then(({ data }) => setActesCatalog((data ?? []) as { id: string; name: string; price: number; scope: ActeScope; category: string; tooth_status: string | null }[]));
  }, [supabase]);

  const [consultation, setConsultation] = useState<ConsultationWithPatient>(initialConsultation);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patientName = consultation.patients
    ? `${(consultation.patients as { first_name: string; last_name: string }).first_name} ${(consultation.patients as { first_name: string; last_name: string }).last_name}`
    : null;

  function openEdit() {
    setForm({
      motif: consultation.motif,
      exam_date: consultation.exam_date ?? "",
      next_exam_date: consultation.next_exam_date ?? "",
      treated_by: consultation.treated_by ?? "",
      praticien_id: consultation.praticien_id ?? "",
      teeth: consultation.teeth ?? "",
      clinical_notes: consultation.clinical_notes ?? "",
      exams: consultation.exams ?? "",
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
    if (!form.exam_date) { setFormError(t("detail.errDate")); return; }
    setSaving(true); setFormError("");
    const payload = {
      motif: form.motif,
      exam_date: form.exam_date,
      next_exam_date: form.next_exam_date || null,
      treated_by: form.treated_by.trim() || null,
      praticien_id: form.praticien_id || null,
      teeth: form.teeth.trim() || null,
      clinical_notes: form.clinical_notes.trim() || null,
      exams: form.exams.trim() || null,
    };
    const { data, error } = await supabase.from("consultations").update(payload).eq("id", consultation.id).select("*, patients(first_name, last_name)").single();
    if (error) { setFormError(error.message); setSaving(false); return; }
    setConsultation(data as ConsultationWithPatient);
    setSaving(false); setModalOpen(false);
  }

  const [addActesOpen, setAddActesOpen] = useState(false);
  const [savingActes, setSavingActes] = useState(false);
  async function saveNewActes() {
    if (!dossier || billExtra.length === 0) { setAddActesOpen(false); return; }
    setSavingActes(true);
    await billActesToDossier(supabase, { practiceId, userId: currentUserId, patientId: consultation.patient_id, dossierId: dossier.id, actes: billExtra, acteDate: consultation.exam_date });
    const { data: items } = await supabase.from("facture_items")
      .select("id, description, quantity, unit_price, teeth, factures!inner(dossier_id)")
      .eq("factures.dossier_id", dossier.id).eq("acte_date", consultation.exam_date);
    setActeItems((items ?? []) as unknown as { id: string; description: string; quantity: number; unit_price: number; teeth: string[] | null }[]);
    setBillExtra([]);
    setSavingActes(false);
    setAddActesOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("consultations").delete().eq("id", consultation.id);
    router.push(`/${locale}/dashboard/consultations`);
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
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl shrink-0">🏥</div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("detail.title")} — {t.has(`motif.${consultation.motif}`) ? t(`motif.${consultation.motif}`) : consultation.motif}</h1>
            {patientName && (
              <button
                onClick={() => router.push(`/${locale}/dashboard/patients/${consultation.patient_id}`)}
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
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MOTIF_STYLE[consultation.motif] ?? MOTIF_STYLE.autre}`}>
              {t.has(`motif.${consultation.motif}`) ? t(`motif.${consultation.motif}`) : consultation.motif}
            </span>
          </div>
          <div className="space-y-1">
            <DR label={t("detail.patient")} value={patientName} />
            <AlwaysRow label={t("detail.date")} value={fmtDate(consultation.exam_date)} />
            <AlwaysRow label={t("detail.nextExam")} value={consultation.next_exam_date ? fmtDate(consultation.next_exam_date) : null} />
            <AlwaysRow label={t("detail.dentist")} value={consultation.treated_by ? t("detail.drName", { name: consultation.treated_by }) : null} />
            {consultation.teeth && <DR label={t("detail.teeth")} value={consultation.teeth} />}
            <AlwaysRow label={t("detail.clinicalNotes")} value={consultation.clinical_notes} />
            <AlwaysRow label={t("detail.exams")} value={consultation.exams} />
            <DR label={t("detail.createdAt")} value={fmtDate(consultation.created_at)} />
          </div>

          <AuditInfo createdBy={consultation.created_by} createdAt={consultation.created_at} updatedBy={consultation.updated_by} updatedAt={consultation.updated_at} className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800" />
        </div>

        {(dossier || originRdv || facturation) && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">{t("detail.attachBilling")}</h2>
            <div className="space-y-1">
              {dossier && (
                <div className="flex gap-3 py-0.5">
                  <span className="text-xs text-zinc-400 w-32 shrink-0 pt-0.5">{t("detail.dossier")}</span>
                  <button onClick={() => router.push(`/${locale}/dashboard/dossiers/${dossier.id}`)} className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline text-left">{dossier.title} →</button>
                </div>
              )}
              {originRdv && (
                <div className="flex gap-3 py-0.5">
                  <span className="text-xs text-zinc-400 w-32 shrink-0 pt-0.5">{t("detail.originRdv")}</span>
                  <button onClick={() => router.push(`/${locale}/dashboard/appointments/${originRdv.id}`)} className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline text-left"><LocalInstant iso={originRdv.scheduled_at} options={{ day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }} /> →</button>
                </div>
              )}
            </div>
            {facturation && (
              <>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2.5 text-center">
                    <p className="text-[10px] text-zinc-400 uppercase">{t("detail.billed")}</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{facturation.facture.toFixed(0)}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/10 px-3 py-2.5 text-center">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">{t("detail.paid")}</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{facturation.paye.toFixed(0)}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2.5 text-center ${facturation.reste > 0 ? "bg-amber-50 dark:bg-amber-900/10" : "bg-zinc-50 dark:bg-zinc-800/60"}`}>
                    <p className={`text-[10px] uppercase ${facturation.reste > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-400"}`}>{t("detail.remaining")}</p>
                    <p className={`text-sm font-bold ${facturation.reste > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-500"}`}>{facturation.reste.toFixed(0)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 mt-2">{t("detail.billingNote")}</p>
              </>
            )}
          </div>
        )}

        {/* Actes billed at this visite */}
        {dossier && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{t("detail.actesRealises")} <span className="text-zinc-300">({acteItems.length})</span></h2>
              <button onClick={() => { setBillExtra([]); setAddActesOpen(true); }} className="text-xs px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors">+ {t("detail.addActe")}</button>
            </div>
            {acteItems.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">{t("detail.noActe")}</p>
            ) : (
              <div className="space-y-2">
                {acteItems.map((it) => (
                  <div key={it.id} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{it.description}</p>
                      {it.teeth && it.teeth.length > 0 && (
                        <p className="text-[11px] text-teal-600 dark:text-teal-400">{t("detail.teeth")} : {it.teeth.join(", ")}</p>
                      )}
                      <p className="text-xs text-zinc-400">× {it.quantity}</p>
                    </div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white shrink-0">{(it.quantity * it.unit_price).toFixed(2)} MAD</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ordonnances issued at this visite */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{t("detail.ordonnances")} <span className="text-zinc-300">({ordonnances.length})</span></h2>
            <button onClick={() => router.push(`/${locale}/dashboard/ordonnances?new=1&patient_id=${consultation.patient_id}&consultation_id=${consultation.id}${dossier ? `&dossier_id=${dossier.id}` : ""}`)} className="text-xs px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors">+ {t("detail.newOrdonnance")}</button>
          </div>
          {ordonnances.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">{t("detail.noOrdonnance")}</p>
          ) : (
            <div className="space-y-2">
              {ordonnances.map((o) => (
                <div key={o.id} onClick={() => router.push(`/${locale}/dashboard/ordonnances/${o.id}`)} className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600 transition-all">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">💊 {t("detail.ordonnanceLabel")}</span>
                  <span className="text-xs text-zinc-400">{fmtDate(o.date)}{o.prescriber ? ` · ${t("detail.drName", { name: o.prescriber })}` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 pb-8">
          <button onClick={() => setDeleteOpen(true)}
            className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
            {t("form.delete")}
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
              <h2 className="font-semibold text-zinc-900 dark:text-white">{t("editTitle")}</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.motif")}</label>
                <select {...field("motif")} className={inputCls}>
                  {MOTIFS.map(m => <option key={m} value={m}>{t(`motif.${m}`)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.date")} <span className="text-red-500">*</span></label>
                  <input type="date" {...field("exam_date")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.nextExam")}</label>
                  <input type="date" {...field("next_exam_date")} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.dentist")}</label>
                  <PraticienSelect value={form.praticien_id} onChange={(id, name) => setForm((f) => ({ ...f, praticien_id: id, treated_by: name }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("detail.teeth")}</label>
                  <input placeholder={t("detail.teethPlaceholder")} {...field("teeth")} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.clinicalNotes")}</label>
                <textarea {...field("clinical_notes")} rows={3} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.exams")}</label>
                <textarea {...field("exams")} rows={2} placeholder={t("form.examsPlaceholder")} className={`${inputCls} resize-none`} />
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

      {/* Add actes modal */}
      {addActesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">{t("detail.addActesLabel")}</h2>
              <button onClick={() => setAddActesOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-2 max-h-[70vh] overflow-y-auto">
              {billExtra.map((a, i) => (
                <div key={i} className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{a.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-500">{a.price.toFixed(2)} MAD</span>
                      <button type="button" onClick={() => setBillExtra((xs) => xs.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-red-500 text-sm">✕</button>
                    </div>
                  </div>
                  {a.scope === "tooth" && (
                    <div className="mt-2">
                      <ToothPicker value={a.teeth ?? []} onChange={(teeth) => setBillExtra((xs) => xs.map((x, j) => (j === i ? { ...x, teeth } : x)))} />
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 text-center">{a.teeth && a.teeth.length ? a.teeth.join(", ") : t("form.teethPlaceholder")}</p>
                    </div>
                  )}
                </div>
              ))}
              <select value="" onChange={(e) => { const a = actesCatalog.find((x) => x.id === e.target.value); if (a) setBillExtra((xs) => [...xs, { id: a.id, name: a.name, price: a.price, scope: a.scope, category: a.category, tooth_status: a.tooth_status, teeth: [] }]); }} className={inputCls}>
                <option value="">+ {t("detail.addActe")}</option>
                {actesCatalog.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.price.toFixed(2)} MAD</option>)}
              </select>
              <p className="text-[11px] text-zinc-400">{t("detail.addActesNote")}</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => setAddActesOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">{t("form.cancel")}</button>
              <button onClick={saveNewActes} disabled={savingActes || billExtra.length === 0} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{savingActes ? t("form.saving") : t("form.save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("deleteDialog.title")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t("deleteDialog.body")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                {t("form.cancel")}
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                {deleting ? t("detail.deleting") : t("form.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
