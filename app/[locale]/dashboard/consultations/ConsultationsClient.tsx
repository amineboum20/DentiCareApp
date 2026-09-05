"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { ConsultationWithPatient, ConsultationMotif, Patient } from "@/types/database";
import { useAppContext } from "@/components/AppContext";
import { billActesToDossier } from "@/utils/billing";
import { PraticienSelect } from "@/components/PraticienSelect";

interface Props {
  initialConsultations: ConsultationWithPatient[];
  patients: Pick<Patient, "id" | "first_name" | "last_name">[];
}

const emptyForm = {
  patient_id: "",
  motif: "consultation" as ConsultationMotif,
  exam_date: "",
  next_exam_date: "",
  treated_by: "",
  praticien_id: "",
  clinical_notes: "",
  exams: "",
};

const MOTIF_STYLE: Record<string, string> = {
  consultation: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  controle:     "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  soin:         "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  urgence:      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  autre:        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

const MOTIFS: ConsultationMotif[] = ["consultation", "controle", "soin", "urgence", "autre"];

export default function ConsultationsClient({ initialConsultations, patients }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const { practiceId, currentUserId } = useAppContext();
  const t = useTranslations("visites");

  const [consultations, setConsultations] = useState<ConsultationWithPatient[]>(initialConsultations);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<ConsultationWithPatient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConsultationWithPatient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Optional dossier attach + billing for a new visite (not shown when editing).
  const [actes, setActes] = useState<{ id: string; name: string; price: number }[]>([]);
  const [openDossiers, setOpenDossiers] = useState<{ id: string; title: string }[]>([]);
  const [dossierId, setDossierId] = useState("");
  const [bill, setBill] = useState(false);
  const [billActes, setBillActes] = useState<{ id: string; name: string; price: number }[]>([]);
  const [newDossierMode, setNewDossierMode] = useState(false);
  const [newDossierTitle, setNewDossierTitle] = useState("");
  const [creatingDossier, setCreatingDossier] = useState(false);
  // A visite is today or a forgotten past one — never the future (that's a RDV).
  const today = new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    router.push(`/${locale}/dashboard/consultations/${id}`);
  }, [searchParams, locale, router]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const patientId = searchParams.get("patient_id") ?? "";
    setEditingConsultation(null);
    setForm({ ...emptyForm, patient_id: patientId, exam_date: today });
    setDossierId(""); setBill(false); setBillActes([]); setNewDossierMode(false); setNewDossierTitle("");
    setError("");
    setModalOpen(true);
  }, [searchParams, today]);

  // Load the acte catalogue once (used for optional visit billing).
  useEffect(() => {
    supabase.from("actes").select("id, name, price").order("name")
      .then(({ data }) => setActes((data ?? []) as { id: string; name: string; price: number }[]));
  }, [supabase]);

  // Load the selected patient's OPEN dossiers so a new visite can attach to one.
  useEffect(() => {
    if (!modalOpen || editingConsultation || !form.patient_id) { setOpenDossiers([]); return; }
    supabase.from("dossiers").select("id, title").eq("patient_id", form.patient_id).eq("statut", "ouvert").is("archived_at", null).order("created_at", { ascending: false })
      .then(({ data }) => setOpenDossiers((data ?? []) as { id: string; title: string }[]));
  }, [modalOpen, editingConsultation, form.patient_id, supabase]);

  const filtered = useMemo(() =>
    consultations.filter((c) => {
      const name = `${c.patients.first_name} ${c.patients.last_name}`.toLowerCase();
      return name.includes(search.toLowerCase());
    }),
    [consultations, search]
  );

  function openAdd() {
    setEditingConsultation(null);
    setForm({ ...emptyForm, exam_date: today });
    setDossierId(""); setBill(false); setBillActes([]); setNewDossierMode(false); setNewDossierTitle("");
    setError("");
    setModalOpen(true);
  }
  async function createDossierInline() {
    if (!newDossierTitle.trim() || !form.patient_id) return;
    setCreatingDossier(true);
    const { data, error: e } = await supabase.from("dossiers").insert({
      practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
      patient_id: form.patient_id, title: newDossierTitle.trim(), statut: "ouvert",
    }).select("id, title").single();
    setCreatingDossier(false);
    if (e || !data) return;
    setOpenDossiers((xs) => [{ id: data.id as string, title: data.title as string }, ...xs]);
    setDossierId(data.id as string);
    setNewDossierMode(false); setNewDossierTitle("");
  }

  function field(key: keyof typeof emptyForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    if (!form.patient_id || !form.exam_date.trim()) {
      setError(t("errRequired"));
      return;
    }
    if (form.exam_date > today) {
      setError(t("errFuture"));
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      patient_id: form.patient_id,
      motif: form.motif,
      exam_date: form.exam_date,
      next_exam_date: form.next_exam_date || null,
      treated_by: form.treated_by.trim() || null,
      praticien_id: form.praticien_id || null,
      clinical_notes: form.clinical_notes.trim() || null,
      exams: form.exams.trim() || null,
    };

    if (editingConsultation) {
      const { data, error: err } = await supabase
        .from("consultations")
        .update(payload)
        .eq("id", editingConsultation.id)
        .select("*, patients(first_name, last_name)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setConsultations((cs) => cs.map((c) => (c.id === data.id ? (data as ConsultationWithPatient) : c)));
    } else {
      const { data, error: err } = await supabase
        .from("consultations")
        .insert({ ...payload, dossier_id: dossierId || null, practice_id: practiceId, created_by: currentUserId, user_id: currentUserId })
        .select("*, patients(first_name, last_name)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setConsultations((cs) => [data as ConsultationWithPatient, ...cs]);

      // Bill the selected actes. A facture lives in a dossier, so if none was
      // chosen we auto-create one and attach this visite to it.
      if (bill && billActes.length > 0) {
        let targetDossierId = dossierId;
        if (!targetDossierId) {
          const { data: dz } = await supabase.from("dossiers").insert({
            practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
            patient_id: form.patient_id, title: t("autoDossierTitle", { date: new Date(form.exam_date).toLocaleDateString("fr-FR") }), statut: "ouvert",
          }).select("id").single();
          if (dz) {
            targetDossierId = (dz as { id: string }).id;
            await supabase.from("consultations").update({ dossier_id: targetDossierId }).eq("id", (data as { id: string }).id);
          }
        }
        if (targetDossierId) {
          await billActesToDossier(supabase, { practiceId, userId: currentUserId, patientId: form.patient_id, dossierId: targetDossierId, actes: billActes, acteDate: form.exam_date });
        }
      }
    }

    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("consultations").delete().eq("id", deleteTarget.id);
    setConsultations((cs) => cs.filter((c) => c.id !== deleteTarget.id));
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
          + {t("newVisit")}
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
            <span className="text-4xl mb-3">{search ? "🔍" : "🏥"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {search ? t("noResults") : t("noVisits")}
            </p>
            {!search && (
              <button
                onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
              >
                + {t("newVisit")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("col.patient")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("col.motif")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("col.date")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("col.treatedBy")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("col.teeth")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/${locale}/dashboard/consultations/${c.id}`)}
                    className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">
                      {c.patients.first_name} {c.patients.last_name}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MOTIF_STYLE[c.motif] ?? MOTIF_STYLE.autre}`}>
                        {t.has(`motif.${c.motif}`) ? t(`motif.${c.motif}`) : c.motif}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{fmtDate(c.exam_date)}</td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{c.treated_by ?? "—"}</td>
                    <td className="px-5 py-3.5 text-zinc-400">{c.teeth ?? "—"}</td>
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
                {editingConsultation ? t("editTitle") : t("addTitle")}
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
                  {t("form.patient")} <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.patient_id}
                  onChange={(e) => setForm(f => ({ ...f, patient_id: e.target.value }))}
                  className={inputCls}
                  required
                >
                  <option value="">{t("form.selectPatient")}</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {t("form.motif")} <span className="text-red-500">*</span>
                </label>
                <select {...field("motif")} className={inputCls}>
                  {MOTIFS.map((m) => (
                    <option key={m} value={m}>{t(`motif.${m}`)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.date")} <span className="text-red-500">*</span>
                  </label>
                  <input type="date" max={today} {...field("exam_date")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.nextExam")}
                  </label>
                  <input type="date" {...field("next_exam_date")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.dentist")}</label>
                <PraticienSelect value={form.praticien_id} onChange={(id, name) => setForm((f) => ({ ...f, praticien_id: id, treated_by: name }))} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.clinicalNotes")}</label>
                <textarea {...field("clinical_notes")} rows={3} className={`${inputCls} resize-none`} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.exams")}</label>
                <textarea {...field("exams")} rows={2} placeholder={t("form.examsPlaceholder")} className={`${inputCls} resize-none`} />
              </div>

              {!editingConsultation && (
                <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 space-y-3 bg-zinc-50/60 dark:bg-zinc-800/30">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.linkDossier")}</label>
                    {!newDossierMode ? (
                      <div className="flex gap-1">
                        <select value={dossierId} onChange={(e) => setDossierId(e.target.value)} className={`flex-1 ${inputCls}`} disabled={!form.patient_id}>
                          <option value="">{t("form.noneAuto")}</option>
                          {openDossiers.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                        </select>
                        <button type="button" onClick={() => { setNewDossierMode(true); setNewDossierTitle(""); }} disabled={!form.patient_id} title={t("form.newDossier")} className="px-2.5 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100 text-sm font-bold transition-colors disabled:opacity-40 shrink-0">+</button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <input value={newDossierTitle} onChange={(e) => setNewDossierTitle(e.target.value)} placeholder={t("form.dossierTitlePlaceholder")} className={`flex-1 ${inputCls}`} />
                        <button type="button" onClick={createDossierInline} disabled={creatingDossier || !newDossierTitle.trim()} className="px-2.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition-colors disabled:opacity-40 shrink-0">{creatingDossier ? "…" : t("form.create")}</button>
                        <button type="button" onClick={() => { setNewDossierMode(false); setNewDossierTitle(""); }} className="px-2 text-zinc-400 hover:text-zinc-600 text-sm shrink-0">✕</button>
                      </div>
                    )}
                    {form.patient_id && openDossiers.length === 0 && !newDossierMode && <p className="text-[11px] text-zinc-400 mt-1">{t("form.noOpenDossier")}</p>}
                    {!form.patient_id && <p className="text-[11px] text-zinc-400 mt-1">{t("form.selectPatientFirst")}</p>}
                  </div>
                  {form.patient_id && (
                    <>
                      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                        <input type="checkbox" checked={bill} onChange={(e) => { setBill(e.target.checked); if (e.target.checked && billActes.length === 0) { const c = actes.find((a) => a.name.toLowerCase() === "consultation") ?? actes[0]; if (c) setBillActes([c]); } }} className="w-4 h-4 accent-teal-600" />
                        {t("form.billVisit")}
                      </label>
                      {bill && (
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
                              <option value="">{t("form.addActe")}</option>
                              {actes.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.price.toFixed(2)} MAD</option>)}
                            </select>
                            <div className="flex justify-between text-[11px] text-zinc-400">
                              <span>{dossierId ? t("form.billExistingNote") : t("form.autoDossierNote", { date: form.exam_date ? new Date(form.exam_date).toLocaleDateString("fr-FR") : "…" })}</span>
                              <span className="font-medium text-zinc-600 dark:text-zinc-300">{t("form.totalLabel")} : {billActes.reduce((s, a) => s + a.price, 0).toFixed(2)} MAD</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">{t("form.noActes")}</p>
                        )
                      )}
                    </>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editingConsultation && (
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(editingConsultation); setModalOpen(false); }}
                  className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
                >
                  {t("form.delete")}
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
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("deleteDialog.title")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t("deleteDialog.body")}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t("form.cancel")}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                {t("form.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
