"use client";

import { useMemo, useState } from "react";
import { useEscapeKey, useModalKeys } from "@/utils/useEscapeKey";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Acte, TreatmentCategory } from "@/types/database";
import { useAppContext } from "@/components/AppContext";
import { DR } from "@/components/DetailRow";
import AuditInfo from "@/components/AuditInfo";

type ActeLite = Pick<Acte, "id" | "name" | "price" | "category">;
type PackageLine = {
  id: string;
  acte_id: string;
  quantity: number;
  sort_order: number;
  actes: { id: string; name: string; price: number } | null;
};
type Package = {
  id: string;
  name: string;
  category: TreatmentCategory;
  description: string | null;
  notes: string | null;
  price_override: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  traitement_actes: PackageLine[];
};

const CATEGORY_STYLE: Record<string, string> = {
  nettoyage:   "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  obturation:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  extraction:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  couronne:    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  implant:     "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  orthodontie: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  blanchiment: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  prothese:    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  autre:       "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const CATEGORIES: TreatmentCategory[] = [
  "nettoyage", "obturation", "extraction", "couronne", "implant",
  "orthodontie", "blanchiment", "prothese", "autre",
];

type Line = { acte_id: string; quantity: string };

function computedPrice(pkg: Package): number {
  if (pkg.price_override != null) return pkg.price_override;
  return pkg.traitement_actes.reduce((s, l) => s + (l.actes?.price ?? 0) * l.quantity, 0);
}

export default function TraitementDetailClient({
  traitement,
  actes,
  locale,
}: {
  traitement: Package;
  actes: ActeLite[];
  locale: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { currentUserId } = useAppContext();
  const t = useTranslations("traitements");
  const tcat = useTranslations("categories");

  const [pkg, setPkg] = useState<Package>(traitement);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  useModalKeys(modalOpen, { onClose: () => setModalOpen(false), onSubmit: handleSave });
  useEscapeKey(deleteOpen, () => setDeleteOpen(false));
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", category: "autre" as TreatmentCategory, description: "", price_override: "" });
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const acteById = useMemo(() => Object.fromEntries(actes.map((a) => [a.id, a])), [actes]);
  const sortedLines = useMemo(() => [...pkg.traitement_actes].sort((a, b) => a.sort_order - b.sort_order), [pkg]);

  function openEdit() {
    setForm({
      name: pkg.name,
      category: pkg.category,
      description: pkg.description ?? "",
      price_override: pkg.price_override != null ? String(pkg.price_override) : "",
    });
    setLines(sortedLines.length ? sortedLines.map((l) => ({ acte_id: l.acte_id, quantity: String(l.quantity) })) : [{ acte_id: actes[0]?.id ?? "", quantity: "1" }]);
    setError("");
    setModalOpen(true);
  }

  const formTotal = useMemo(() => {
    if (form.price_override) return parseFloat(form.price_override) || 0;
    return lines.reduce((s, l) => s + (acteById[l.acte_id]?.price ?? 0) * (parseInt(l.quantity) || 0), 0);
  }, [lines, form.price_override, acteById]);

  async function handleSave() {
    if (!form.name.trim()) { setError(t("errName")); return; }
    const validLines = lines.filter((l) => l.acte_id && (parseInt(l.quantity) || 0) > 0);
    if (validLines.length === 0) { setError(t("errNoActe")); return; }
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      price_override: form.price_override ? parseFloat(form.price_override) : null,
    };
    const { error: err } = await supabase.from("traitements").update({ ...payload, updated_by: currentUserId }).eq("id", pkg.id);
    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("traitement_actes").delete().eq("traitement_id", pkg.id);
    const { error: linesErr } = await supabase.from("traitement_actes").insert(
      validLines.map((l, i) => ({ traitement_id: pkg.id, acte_id: l.acte_id, quantity: parseInt(l.quantity) || 1, sort_order: i }))
    );
    if (linesErr) { setError(linesErr.message); setSaving(false); return; }
    setPkg((p) => ({
      ...p,
      name: payload.name,
      category: payload.category,
      description: payload.description,
      price_override: payload.price_override,
      traitement_actes: validLines.map((l, i) => ({
        id: `${pkg.id}-${i}`,
        acte_id: l.acte_id,
        quantity: parseInt(l.quantity) || 1,
        sort_order: i,
        actes: acteById[l.acte_id] ? { id: l.acte_id, name: acteById[l.acte_id].name, price: acteById[l.acte_id].price } : null,
      })),
    }));
    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("traitements").delete().eq("id", pkg.id);
    router.push(`/${locale}/dashboard/traitements`);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";
  const total = computedPrice(pkg);

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.push(`/${locale}/dashboard/traitements`)} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-3">← {t("title")}</button>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{pkg.name}</h1>
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${CATEGORY_STYLE[pkg.category] ?? CATEGORY_STYLE.autre}`}>{tcat(pkg.category)}</span>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Info */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">{t("informations")}</h2>
          <div className="space-y-1">
            <DR label={t("col.price")} value={`${total.toFixed(2)} MAD${pkg.price_override != null ? ` · ${t("flatRate")}` : ""}`} />
            <DR label={t("form.description")} value={pkg.description} />
          </div>
          <AuditInfo createdBy={pkg.created_by} createdAt={pkg.created_at} updatedBy={pkg.updated_by} updatedAt={pkg.updated_at} className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800" />
        </div>

        {/* Composition */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
            {t("form.packageActes")}
            <span className="ml-2 text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{sortedLines.length}</span>
          </h2>
          <div className="space-y-2">
            {sortedLines.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => l.acte_id && router.push(`/${locale}/dashboard/actes/${l.acte_id}`)}
                className="w-full flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-left hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-sm transition-all"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{l.actes?.name ?? "—"}</p>
                  <p className="text-xs text-zinc-400">× {l.quantity}</p>
                </div>
                <span className="text-sm font-medium text-zinc-900 dark:text-white shrink-0">{((l.actes?.price ?? 0) * l.quantity).toFixed(2)} MAD</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2 pb-8">
          <button onClick={() => setDeleteOpen(true)} className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">{t("form.delete")}</button>
          <div className="ms-auto">
            <button onClick={openEdit} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">✏️ {t("edit")}</button>
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.name")} <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder={t("form.namePlaceholder")} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.category")}</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TreatmentCategory }))} className={inputCls}>
                  {CATEGORIES.map((opt) => <option key={opt} value={opt}>{tcat(opt)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">{t("form.packageActes")} <span className="text-red-500">*</span></label>
                {actes.length === 0 ? (
                  <p className="text-xs text-zinc-400">{t("form.noActesAvailable")}</p>
                ) : (
                  <div className="space-y-2">
                    {lines.map((l, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select value={l.acte_id} onChange={(e) => setLines((xs) => xs.map((x, j) => (j === i ? { ...x, acte_id: e.target.value } : x)))} className={`${inputCls} flex-1`}>
                          {actes.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.price.toFixed(2)} MAD</option>)}
                        </select>
                        <input type="number" min="1" value={l.quantity} onChange={(e) => setLines((xs) => xs.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className="w-16 px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        <button type="button" onClick={() => setLines((xs) => xs.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-red-500 px-1.5 text-lg leading-none" aria-label={t("form.remove")}>×</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setLines((xs) => [...xs, { acte_id: actes[0]?.id ?? "", quantity: "1" }])} className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium">+ {t("form.addActe")}</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.flatPrice")}</label>
                  <input type="number" min="0" step="0.01" value={form.price_override} onChange={(e) => setForm((f) => ({ ...f, price_override: e.target.value }))} placeholder={t("form.autoPlaceholder")} className={inputCls} />
                  <p className="text-[10px] text-zinc-400 mt-1">{t("form.flatHint")}</p>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.total")}</label>
                  <div className="px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-sm font-semibold">{formTotal.toFixed(2)} MAD</div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.description")}</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">{t("form.cancel")}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{saving ? t("form.saving") : t("form.save")}</button>
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
              <button onClick={() => setDeleteOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">{t("form.cancel")}</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">{t("form.delete")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
