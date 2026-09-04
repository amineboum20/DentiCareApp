"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { ConsultationWithPatient, ConsultationMotif, Patient } from "@/types/database";
import { useAppContext } from "@/components/AppContext";

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
  teeth: "",
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

const MOTIF_LABEL: Record<string, string> = {
  consultation: "Consultation",
  controle:     "Contrôle",
  soin:         "Soin",
  urgence:      "Urgence",
  autre:        "Autre",
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
  const [billActeId, setBillActeId] = useState("");
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
    setDossierId(""); setBill(false); setBillActeId("");
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
    setDossierId(""); setBill(false); setBillActeId("");
    setError("");
    setModalOpen(true);
  }
  function defaultActeId() {
    const cons = actes.find((a) => a.name.toLowerCase() === "consultation");
    return (cons ?? actes[0])?.id ?? "";
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
      setError("Le patient et la date sont obligatoires.");
      return;
    }
    if (form.exam_date > today) {
      setError("Une visite ne peut pas être dans le futur — planifiez plutôt un rendez-vous.");
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
      teeth: form.teeth.trim() || null,
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

      // Optional: bill this visite into the chosen dossier — append the acte to an
      // open facture of that dossier, creating one if none (mirrors the hub).
      if (dossierId && bill && billActeId) {
        const acte = actes.find((a) => a.id === billActeId);
        if (acte) {
          const { data: facs } = await supabase.from("factures").select("id, total_price, status, type").eq("dossier_id", dossierId);
          let target = (facs ?? []).find((f) => f.type === "facture" && f.status !== "annulee" && f.status !== "payee") as { id: string; total_price: number } | undefined;
          if (!target) {
            const { data: fac } = await supabase.from("factures").insert({
              practice_id: practiceId, created_by: currentUserId, user_id: currentUserId,
              patient_id: form.patient_id, dossier_id: dossierId,
              type: "facture", status: "en_attente", total_price: 0, deposit_paid: 0,
            }).select("id, total_price").single();
            target = fac as { id: string; total_price: number } | undefined;
          }
          if (target) {
            await supabase.from("facture_items").insert({ facture_id: target.id, acte_id: acte.id, description: acte.name, quantity: 1, unit_price: acte.price });
            await supabase.from("factures").update({ total_price: Number(target.total_price) + Number(acte.price) }).eq("id", target.id);
          }
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
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Visites</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
        >
          + Nouvelle visite
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Rechercher par patient…"
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
              {search ? "Aucun résultat" : "Aucune visite pour l'instant"}
            </p>
            {!search && (
              <button
                onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
              >
                + Nouvelle visite
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Patient</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Motif</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Date</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Traité par</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Dents</th>
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
                        {MOTIF_LABEL[c.motif] ?? c.motif}
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
                {editingConsultation ? "Modifier la visite" : "Nouvelle visite"}
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
                  Patient <span className="text-red-500">*</span>
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
                  Motif <span className="text-red-500">*</span>
                </label>
                <select {...field("motif")} className={inputCls}>
                  {MOTIFS.map((m) => (
                    <option key={m} value={m}>{MOTIF_LABEL[m]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input type="date" max={today} {...field("exam_date")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Prochain contrôle
                  </label>
                  <input type="date" {...field("next_exam_date")} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Dentiste</label>
                  <input type="text" placeholder="Dr. Nom" {...field("treated_by")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Dents concernées</label>
                  <input type="text" placeholder="Ex. 11, 12, 21…" {...field("teeth")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes cliniques</label>
                <textarea {...field("clinical_notes")} rows={3} className={`${inputCls} resize-none`} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Examens complémentaires</label>
                <textarea {...field("exams")} rows={2} placeholder="Radio, scanner, test…" className={`${inputCls} resize-none`} />
              </div>

              {!editingConsultation && (
                <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 space-y-3 bg-zinc-50/60 dark:bg-zinc-800/30">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Rattacher à un dossier</label>
                    <select value={dossierId} onChange={(e) => { setDossierId(e.target.value); if (!e.target.value) setBill(false); }} className={inputCls} disabled={!form.patient_id}>
                      <option value="">— Aucun (visite simple) —</option>
                      {openDossiers.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                    {form.patient_id && openDossiers.length === 0 && <p className="text-[11px] text-zinc-400 mt-1">Aucun dossier ouvert pour ce patient.</p>}
                  </div>
                  {dossierId && (
                    <>
                      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                        <input type="checkbox" checked={bill} onChange={(e) => { setBill(e.target.checked); if (e.target.checked && !billActeId) setBillActeId(defaultActeId()); }} className="w-4 h-4 accent-teal-600" />
                        Facturer cette visite
                      </label>
                      {bill && (
                        actes.length > 0 ? (
                          <div>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Acte à facturer</label>
                            <select value={billActeId} onChange={(e) => setBillActeId(e.target.value)} className={inputCls}>
                              {actes.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.price.toFixed(2)} MAD</option>)}
                            </select>
                            <p className="text-[11px] text-zinc-400 mt-1">Ajouté à une facture ouverte du dossier (créée si besoin).</p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">Aucun acte au catalogue — créez un acte « Consultation » pour pouvoir facturer.</p>
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
                  Supprimer
                </button>
              )}
              <div className="ms-auto flex items-center gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
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
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Supprimer cette visite ?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
