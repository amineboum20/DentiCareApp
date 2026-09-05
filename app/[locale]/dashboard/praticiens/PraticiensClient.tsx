"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Praticien } from "@/types/database";
import { useAppContext } from "@/components/AppContext";

interface Props {
  initial: Praticien[];
}

const emptyForm = { name: "", inpe: "", numero_ordre: "", speciality: "", phone: "" };

export default function PraticiensClient({ initial }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1];
  const { practiceId, currentUserId } = useAppContext();
  const t = useTranslations("praticiens");

  const [praticiens, setPraticiens] = useState<Praticien[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Praticien | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openAdd() { setEditing(null); setForm(emptyForm); setError(""); setModalOpen(true); }
  function openEdit(p: Praticien) {
    setEditing(p);
    setForm({ name: p.name, inpe: p.inpe ?? "", numero_ordre: p.numero_ordre ?? "", speciality: p.speciality ?? "", phone: p.phone ?? "" });
    setError(""); setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError(t("errNameRequired")); return; }
    setSaving(true); setError("");
    const payload = {
      name: form.name.trim(), inpe: form.inpe.trim() || null, numero_ordre: form.numero_ordre.trim() || null,
      speciality: form.speciality.trim() || null, phone: form.phone.trim() || null,
    };
    if (editing) {
      const { data, error: e } = await supabase.from("praticiens").update(payload).eq("id", editing.id).select("*").single();
      if (e) { setError(e.message); setSaving(false); return; }
      setPraticiens((xs) => xs.map((p) => p.id === (data as Praticien).id ? (data as Praticien) : p).sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      const { data, error: e } = await supabase.from("praticiens").insert({ ...payload, practice_id: practiceId, user_id: currentUserId, created_by: currentUserId }).select("*").single();
      if (e) { setError(e.message); setSaving(false); return; }
      setPraticiens((xs) => [...xs, data as Praticien].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setSaving(false); setModalOpen(false);
  }

  async function handleArchive() {
    if (!editing) return;
    await supabase.from("praticiens").update({ archived_at: new Date().toISOString() }).eq("id", editing.id);
    setPraticiens((xs) => xs.filter((p) => p.id !== editing.id));
    setModalOpen(false);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <>
      <button onClick={() => router.push(`/${locale}/dashboard/settings`)} className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors mb-4">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4" /></svg>
        {t("backToSettings")}
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">+ {t("newPraticien")}</button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {praticiens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">🧑‍⚕️</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
            <button onClick={openAdd} className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium">+ {t("newPraticien")}</button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
            {praticiens.map((p) => (
              <div key={p.id} onClick={() => openEdit(p)} className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{t("drPrefix")} {p.name}{p.speciality ? <span className="text-zinc-400 font-normal"> · {p.speciality}</span> : null}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{[p.inpe && `INPE ${p.inpe}`, p.numero_ordre && `${t("ordreShort")} ${p.numero_ordre}`].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <span className="text-xs text-zinc-300 shrink-0 ms-2">{t("editArrow")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">{editing ? t("editTitle") : t("addTitle")}</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.name")} <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("form.namePlaceholder")} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">INPE</label>
                  <input value={form.inpe} onChange={(e) => setForm((f) => ({ ...f, inpe: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.numeroOrdre")}</label>
                  <input value={form.numero_ordre} onChange={(e) => setForm((f) => ({ ...f, numero_ordre: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.speciality")}</label>
                  <input value={form.speciality} onChange={(e) => setForm((f) => ({ ...f, speciality: e.target.value }))} placeholder={t("form.specialityPlaceholder")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.phone")}</label>
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editing && (
                <button onClick={handleArchive} className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">{t("archive")}</button>
              )}
              <div className="ms-auto flex items-center gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">{t("cancel")}</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{saving ? t("saving") : t("save")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
