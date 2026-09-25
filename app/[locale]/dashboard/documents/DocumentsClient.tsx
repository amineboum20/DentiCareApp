"use client";

// Documents: every PDF the app generates, in one list. Filter by type, date,
// author and client; download one, or tick several and download them as a ZIP.
// Documents are rebuilt on demand from the live records (utils/documents.ts).

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/client";
import { useAppContext } from "@/components/AppContext";
import ErrorBanner from "@/components/ErrorBanner";
import { DOC_KINDS, DOC_ICONS, listDocuments, renderDocument, type DocKind, type DocRow } from "@/utils/documents";

const PAGE = 100;

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DocumentsClient() {
  const t = useTranslations("documents");
  const tRoot = useTranslations();
  const locale = useLocale();
  const { members, shopName, shopAddress, shopPhone, logoUrl } = useAppContext();
  const supabase = useMemo(() => createClient(), []);

  const [rows, setRows] = useState<DocRow[] | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<DocKind | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [author, setAuthor] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    listDocuments(supabase).then(setRows).catch(() => { setRows([]); setError(t("loadError")); });
  }, [supabase, t]);

  const memberName = useMemo(() => {
    const m = new Map(members.map((x) => [x.user_id, `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim()]));
    return (id: string | null) => (id ? m.get(id) || "—" : "—");
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) =>
      (kind === "all" || r.kind === kind) &&
      (!from || r.date >= from) &&
      (!to || r.date <= to) &&
      (author === "all" || r.createdBy === author) &&
      (!q || r.party.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q)));
  }, [rows, kind, from, to, author, search]);

  const visible = filtered.slice(0, limit);
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.key));
  const selectedRows = (rows ?? []).filter((r) => selected.has(r.key));
  const intl = locale === "ar" ? "ar" : locale === "en" ? "en" : "fr";
  const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(intl, { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
  const shop = { shopName, shopAddress, shopPhone, logoUrl };

  function toggle(key: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) filtered.forEach((r) => n.delete(r.key)); else filtered.forEach((r) => n.add(r.key));
      return n;
    });
  }
  function resetFilters() { setKind("all"); setFrom(""); setTo(""); setAuthor("all"); setSearch(""); setLimit(PAGE); }

  async function downloadOne(row: DocRow) {
    setError(""); setBusyKey(row.key);
    try {
      const f = await renderDocument(supabase, row, shop, tRoot);
      saveBlob(f.blob, f.filename);
    } catch {
      setError(t("error"));
    } finally {
      setBusyKey(null);
    }
  }

  async function downloadZip() {
    if (selectedRows.length === 0) return;
    setError("");
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const used = new Set<string>();
    let failed = 0;
    for (let i = 0; i < selectedRows.length; i++) {
      setZipProgress({ current: i + 1, total: selectedRows.length });
      try {
        const f = await renderDocument(supabase, selectedRows[i], shop, tRoot);
        let name = f.filename, n = 2;
        while (used.has(name)) name = f.filename.replace(/\.pdf$/, `-${n++}.pdf`);
        used.add(name);
        zip.file(name, f.blob);
      } catch {
        failed++;
      }
    }
    try {
      if (used.size > 0) saveBlob(await zip.generateAsync({ type: "blob" }), `documents-${new Date().toISOString().slice(0, 10)}.zip`);
      if (failed > 0) setError(t("zipPartial", { count: failed }));
    } catch {
      setError(t("zipError"));
    } finally {
      setZipProgress(null);
    }
  }

  const inputCls = "px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500";
  const filtersOn = kind !== "all" || from || to || author !== "all" || search;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{t("subtitle")}</p>
        </div>
        <button onClick={downloadZip} disabled={selectedRows.length === 0 || !!zipProgress}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
          🗜️ {zipProgress ? t("generating", zipProgress) : t("downloadZip", { count: selectedRows.length })}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }}
            placeholder={t("searchClient")} className={`${inputCls} w-full ps-9`} />
        </div>
        <select value={kind} onChange={(e) => { setKind(e.target.value as DocKind | "all"); setLimit(PAGE); }} className={inputCls} aria-label={t("colType")}>
          <option value="all">{t("allTypes")}</option>
          {DOC_KINDS.map((k) => <option key={k} value={k}>{DOC_ICONS[k]} {t(`kinds.${k}`)}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {t("from")}
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setLimit(PAGE); }} className={inputCls} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {t("to")}
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setLimit(PAGE); }} className={inputCls} />
        </label>
        <select value={author} onChange={(e) => { setAuthor(e.target.value); setLimit(PAGE); }} className={inputCls} aria-label={t("colCreatedBy")}>
          <option value="all">{t("allMembers")}</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>{`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "—"}</option>)}
        </select>
        {filtersOn && (
          <button onClick={resetFilters} className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">{t("reset")}</button>
        )}
      </div>

      <ErrorBanner message={error} className="mb-4" />

      {rows === null ? (
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/40" />
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 py-16 text-center">
          <span className="text-4xl">🗂️</span>
          <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("empty")}</p>
          <p className="text-xs text-zinc-400 mt-1">{t(filtersOn ? "emptyFiltered" : "emptyDesc")}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-teal-600 w-4 h-4" />
              {t("selectAll")}
            </label>
            <span>{t("count", { count: filtered.length })}{selectedRows.length > 0 ? ` · ${t("selectedCount", { count: selectedRows.length })}` : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-[11px] uppercase tracking-wide text-zinc-400">
                  <th className="w-10 px-4 py-2" />
                  <th className="px-3 py-2 text-start font-medium">{t("colType")}</th>
                  <th className="px-3 py-2 text-start font-medium">{t("colClient")}</th>
                  <th className="px-3 py-2 text-start font-medium">{t("colRef")}</th>
                  <th className="px-3 py-2 text-start font-medium">{t("colDate")}</th>
                  <th className="px-3 py-2 text-start font-medium">{t("colCreatedBy")}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {visible.map((r) => (
                  <tr key={r.key} className={selected.has(r.key) ? "bg-teal-50/60 dark:bg-teal-900/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} className="accent-teal-600 w-4 h-4" aria-label={t("select")} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-700 dark:text-zinc-300">{DOC_ICONS[r.kind]} {t(`kinds.${r.kind}`)}</td>
                    <td className="px-3 py-2.5">
                      <Link href={r.href} className="font-medium text-zinc-900 dark:text-white hover:underline">{r.party || "—"}</Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{r.reference || "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400">{memberName(r.createdBy)}</td>
                    <td className="px-4 py-2.5 text-end">
                      <button onClick={() => downloadOne(r)} disabled={busyKey === r.key}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-teal-400 hover:text-teal-600 disabled:opacity-50 whitespace-nowrap">
                        {busyKey === r.key ? "…" : `📄 ${t("download")}`}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > limit && (
            <button onClick={() => setLimit((l) => l + PAGE)} className="w-full py-3 text-sm text-teal-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border-t border-zinc-100 dark:border-zinc-800">
              {t("showMore", { count: filtered.length - limit })}
            </button>
          )}
        </div>
      )}
    </>
  );
}
