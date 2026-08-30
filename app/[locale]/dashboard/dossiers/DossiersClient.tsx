"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { DossierWithPatient, DossierStatut, Patient } from "@/types/database";
import { useAppContext } from "@/components/AppContext";

interface Props {
  initialDossiers: DossierWithPatient[];
  patients: Pick<Patient, "id" | "first_name" | "last_name">[];
}

const emptyForm = {
  patient_id: "",
  title: "",
  statut: "ouvert" as DossierStatut,
  notes: "",
};

const STATUT_STYLE: Record<string, string> = {
  ouvert:  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  termine: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUT_LABEL: Record<string, string> = {
  ouvert:  "Ouvert",
  termine: "Terminé",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function DossiersClient({ initialDossiers, patients }: Props) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1];
  const { practiceId, currentUserId } = useAppContext();

  const [dossiers, setDossiers] = useState<DossierWithPatient[]>(initialDossiers);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const patientId = searchParams.get("patient_id") ?? "";
    setForm({ ...emptyForm, patient_id: patientId });
    setError("");
    setModalOpen(true);
  }, [searchParams]);

  const filtered = useMemo(() =>
    dossiers.filter((d) => {
      const name = `${d.patients.first_name} ${d.patients.last_name} ${d.title}`.toLowerCase();
      return name.includes(search.toLowerCase());
    }),
    [dossiers, search]
  );

  function openAdd() {
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function field(key: keyof typeof emptyForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    if (!form.patient_id || !form.title.trim()) {
      setError("Le patient et l'intitulé sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      patient_id: form.patient_id,
      title: form.title.trim(),
      statut: form.statut,
      notes: form.notes.trim() || null,
    };

    const { data, error: err } = await supabase
      .from("dossiers")
      .insert({ ...payload, practice_id: practiceId, created_by: currentUserId, user_id: currentUserId })
      .select("*, patients(first_name, last_name)")
      .single();
    if (err) { setError(err.message); setSaving(false); return; }

    setSaving(false);
    setModalOpen(false);
    router.push(`/${locale}/dashboard/dossiers/${(data as DossierWithPatient).id}`);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dossiers</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
        >
          + Nouveau dossier
        </button>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        Un dossier regroupe les visites, les factures et les paiements d&apos;un même traitement.
      </p>

      <div className="relative mb-5">
        <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Rechercher par patient ou intitulé…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-9 pe-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">{search ? "🔍" : "📁"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {search ? "Aucun résultat" : "Aucun dossier pour l'instant"}
            </p>
            {!search && (
              <button
                onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
              >
                + Nouveau dossier
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Patient</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Intitulé</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Statut</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">Ouvert le</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/${locale}/dashboard/dossiers/${d.id}`)}
                    className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">
                      {d.patients.first_name} {d.patients.last_name}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-300">{d.title}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[d.statut] ?? STATUT_STYLE.ouvert}`}>
                        {STATUT_LABEL[d.statut] ?? d.statut}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400">{fmtDate(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Nouveau dossier</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Patient <span className="text-red-500">*</span></label>
                <select value={form.patient_id} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))} className={inputCls} required>
                  <option value="">— Sélectionner un patient —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Intitulé <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Ex. Couronne sur 26, Traitement orthodontique…" {...field("title")} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Statut</label>
                <select {...field("statut")} className={inputCls}>
                  <option value="ouvert">Ouvert</option>
                  <option value="termine">Terminé</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes</label>
                <textarea {...field("notes")} rows={3} className={`${inputCls} resize-none`} />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="ms-auto flex items-center gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Annuler</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                  {saving ? "Création…" : "Créer le dossier"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
