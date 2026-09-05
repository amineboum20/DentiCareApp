"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { OrdonnanceWithPatient, Patient } from "@/types/database";
import { useAppContext } from "@/components/AppContext";
import { PraticienSelect } from "@/components/PraticienSelect";

interface Props {
  initialOrdonnances: OrdonnanceWithPatient[];
  patients: Pick<Patient, "id" | "first_name" | "last_name">[];
}

type Line = { medicament_id: string | null; name: string; posologie: string; duree: string; quantite: string; instructions: string };
const emptyLine: Line = { medicament_id: null, name: "", posologie: "", duree: "", quantite: "", instructions: "" };
type MedLite = { id: string; name: string; default_posologie: string | null; default_duree: string | null; default_quantite: string | null; default_instructions: string | null };

const MOTIF_LABEL: Record<string, string> = {
  consultation: "Consultation", controle: "Contrôle", soin: "Soin", urgence: "Urgence", autre: "Autre",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function OrdonnancesClient({ initialOrdonnances, patients }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1];
  const { practiceId, currentUserId } = useAppContext();

  const today = new Date().toLocaleDateString("en-CA");
  const [ordonnances, setOrdonnances] = useState<OrdonnanceWithPatient[]>(initialOrdonnances);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", date: today, prescriber: "", praticien_id: "", notes: "", consultation_id: "" });
  const [dossierId, setDossierId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [patientVisites, setPatientVisites] = useState<{ id: string; exam_date: string; motif: string }[]>([]);
  const [medications, setMedications] = useState<MedLite[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = searchParams.get("detail");
    if (id) router.push(`/${locale}/dashboard/ordonnances/${id}`);
  }, [searchParams, locale, router]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setForm({ patient_id: searchParams.get("patient_id") ?? "", date: today, prescriber: "", praticien_id: "", notes: "", consultation_id: searchParams.get("consultation_id") ?? "" });
    setDossierId(searchParams.get("dossier_id") ?? "");
    setLines([{ ...emptyLine }]);
    setError("");
    setModalOpen(true);
  }, [searchParams, today]);

  useEffect(() => {
    if (!modalOpen || !form.patient_id) { setPatientVisites([]); return; }
    supabase.from("consultations").select("id, exam_date, motif").eq("patient_id", form.patient_id).order("exam_date", { ascending: false })
      .then(({ data }) => setPatientVisites((data ?? []) as { id: string; exam_date: string; motif: string }[]));
  }, [modalOpen, form.patient_id, supabase]);

  useEffect(() => {
    if (!modalOpen) return;
    supabase.from("medicaments").select("id, name, default_posologie, default_duree, default_quantite, default_instructions").is("archived_at", null).order("name")
      .then(({ data }) => setMedications((data ?? []) as MedLite[]));
  }, [modalOpen, supabase]);

  const filtered = useMemo(() =>
    ordonnances.filter((o) => `${o.patients.first_name} ${o.patients.last_name}`.toLowerCase().includes(search.toLowerCase())),
    [ordonnances, search]);

  function openAdd() {
    setForm({ patient_id: "", date: today, prescriber: "", praticien_id: "", notes: "", consultation_id: "" });
    setDossierId(""); setLines([{ ...emptyLine }]); setError(""); setModalOpen(true);
  }

  async function handleSave() {
    if (!form.patient_id) { setError("Le patient est requis."); return; }
    const validLines = lines.filter((l) => l.name.trim());
    if (validLines.length === 0) { setError("Ajoutez au moins un médicament."); return; }
    setSaving(true); setError("");

    // If a visite is linked, inherit its dossier.
    let dossier = dossierId;
    if (form.consultation_id) {
      const { data: c } = await supabase.from("consultations").select("dossier_id").eq("id", form.consultation_id).single();
      dossier = (c as { dossier_id: string | null } | null)?.dossier_id ?? dossier;
    }

    const { data: ord, error: e } = await supabase.from("ordonnances").insert({
      practice_id: practiceId, user_id: currentUserId, created_by: currentUserId,
      patient_id: form.patient_id, consultation_id: form.consultation_id || null, dossier_id: dossier || null,
      prescriber: form.prescriber.trim() || null, praticien_id: form.praticien_id || null, date: form.date, notes: form.notes.trim() || null,
    }).select("*, patients(first_name, last_name, phone)").single();
    if (e || !ord) { setError(e?.message ?? "Erreur"); setSaving(false); return; }

    await supabase.from("ordonnance_lignes").insert(validLines.map((l, i) => ({
      ordonnance_id: (ord as { id: string }).id, medicament_id: l.medicament_id ?? null, name: l.name.trim(),
      posologie: l.posologie.trim() || null, duree: l.duree.trim() || null,
      quantite: l.quantite.trim() || null, instructions: l.instructions.trim() || null, sort_order: i,
    })));

    setOrdonnances((xs) => [ord as OrdonnanceWithPatient, ...xs]);
    setSaving(false); setModalOpen(false);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Ordonnances</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/${locale}/dashboard/medicaments`)} className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors">💊 Catalogue</button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">+ Nouvelle ordonnance</button>
        </div>
      </div>

      <div className="relative mb-5">
        <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
        <input type="text" placeholder="Rechercher par patient…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-9 pe-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500" />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">{search ? "🔍" : "💊"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{search ? "Aucun résultat" : "Aucune ordonnance"}</p>
            {!search && <button onClick={openAdd} className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium">+ Nouvelle ordonnance</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Patient</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Date</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Prescripteur</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} onClick={() => router.push(`/${locale}/dashboard/ordonnances/${o.id}`)}
                    className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">
                      {o.patients.first_name} {o.patients.last_name}
                      {o.status === "annulee" && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Annulée</span>}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{fmtDate(o.date)}</td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{o.prescriber ? `Dr. ${o.prescriber}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Nouvelle ordonnance</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Patient <span className="text-red-500">*</span></label>
                  <select value={form.patient_id} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value, consultation_id: "" }))} className={inputCls}>
                    <option value="">— Sélectionner un patient —</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Prescripteur (dentiste)</label>
                  <PraticienSelect value={form.praticien_id} onChange={(id, name) => setForm((f) => ({ ...f, praticien_id: id, prescriber: name }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">🦷 Visite liée (optionnel)</label>
                  <select value={form.consultation_id} onChange={(e) => setForm((f) => ({ ...f, consultation_id: e.target.value }))} className={inputCls} disabled={!form.patient_id}>
                    <option value="">— Aucune —</option>
                    {patientVisites.map((v) => <option key={v.id} value={v.id}>{fmtDate(v.exam_date)} — {MOTIF_LABEL[v.motif] ?? v.motif}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Médicaments <span className="text-red-500">*</span></label>
                <div className="space-y-3">
                  {lines.map((l, i) => (
                    <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 bg-zinc-50/60 dark:bg-zinc-800/30">
                      {medications.length > 0 && (
                        <select value={l.medicament_id ?? ""} onChange={(e) => {
                          const m = medications.find((x) => x.id === e.target.value);
                          setLines((xs) => xs.map((x, j) => j === i ? (m ? { medicament_id: m.id, name: m.name, posologie: m.default_posologie ?? "", duree: m.default_duree ?? "", quantite: m.default_quantite ?? "", instructions: m.default_instructions ?? "" } : { ...x, medicament_id: null }) : x));
                        }} className={inputCls}>
                          <option value="">— Choisir dans le catalogue (ou saisir ci-dessous) —</option>
                          {medications.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      )}
                      <div className="flex gap-2 items-center">
                        <input placeholder="Médicament (ex. Amoxicilline 500mg)" value={l.name} onChange={(e) => setLines((xs) => xs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={`flex-1 ${inputCls}`} />
                        <button type="button" onClick={() => setLines((xs) => xs.length > 1 ? xs.filter((_, j) => j !== i) : xs)} className="text-zinc-300 hover:text-red-500 text-sm shrink-0">✕</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input placeholder="Posologie" value={l.posologie} onChange={(e) => setLines((xs) => xs.map((x, j) => j === i ? { ...x, posologie: e.target.value } : x))} className={inputCls} />
                        <input placeholder="Durée" value={l.duree} onChange={(e) => setLines((xs) => xs.map((x, j) => j === i ? { ...x, duree: e.target.value } : x))} className={inputCls} />
                        <input placeholder="Quantité" value={l.quantite} onChange={(e) => setLines((xs) => xs.map((x, j) => j === i ? { ...x, quantite: e.target.value } : x))} className={inputCls} />
                      </div>
                      <input placeholder="Instructions (ex. après les repas)" value={l.instructions} onChange={(e) => setLines((xs) => xs.map((x, j) => j === i ? { ...x, instructions: e.target.value } : x))} className={inputCls} />
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setLines((xs) => [...xs, { ...emptyLine }])} className="mt-2 text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium">+ Ajouter un médicament</button>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="ms-auto flex items-center gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Annuler</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{saving ? "Enregistrement…" : "Enregistrer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
