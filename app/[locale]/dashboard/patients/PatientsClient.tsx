"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import type { Patient } from "@/types/database";
import { useAppContext } from "@/components/AppContext";

interface Props {
  initialPatients: Patient[];
}

const emptyForm = {
  first_name: "", last_name: "", email: "",
  phone: "", date_of_birth: "", address: "", notes: "",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function PatientsClient({ initialPatients }: Props) {
  const t = useTranslations("patients");
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const { practiceId, currentUserId } = useAppContext();
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

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    router.push(`/${locale}/dashboard/patients/${id}`);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setEditingPatient(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }, [searchParams]);

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
        .insert({ ...payload, practice_id: practiceId, created_by: currentUserId, user_id: currentUserId })
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
                  onClick={() => router.push(`/${locale}/dashboard/patients/${c.id}`)}
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
