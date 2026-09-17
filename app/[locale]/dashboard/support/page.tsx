"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SupportPage() {
  const t = useTranslations("support");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    if (next.length > MAX_FILES) { setError(t("tooManyFiles", { max: MAX_FILES })); return; }
    if (next.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) { setError(t("tooLarge")); return; }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(i: number) {
    setFiles(files.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("message", message);
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/support", { method: "POST", body: fd });
      if (!res.ok) throw new Error("failed");
      setSent(true);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{t("title")}</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t("subtitle")}</p>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8">
        {sent ? (
          <div className="text-center py-6">
            <span className="text-5xl">✅</span>
            <h2 className="mt-4 text-xl font-bold text-zinc-900 dark:text-white">{t("successTitle")}</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("successDesc")}</p>
            <button onClick={() => { setSent(false); setSubject(""); setMessage(""); setFiles([]); }}
              className="mt-6 text-sm text-teal-600 font-medium hover:underline">{t("newRequest")}</button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("subject")}</label>
                <input type="text" placeholder={t("subjectPlaceholder")} value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("message")}</label>
                <textarea placeholder={t("messagePlaceholder")} value={message} rows={6}
                  onChange={e => setMessage(e.target.value)} required
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition resize-y" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("attachments")}</label>
                <input ref={inputRef} type="file" multiple onChange={e => addFiles(e.target.files)}
                  className="block w-full text-sm text-zinc-500 dark:text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 dark:file:bg-teal-900/30 file:px-4 file:py-2 file:text-sm file:font-medium file:text-teal-700 dark:file:text-teal-300 hover:file:bg-teal-100 dark:hover:file:bg-teal-900/50 file:cursor-pointer" />
                <p className="text-xs text-zinc-400">{t("attachmentsHint", { max: MAX_FILES })}</p>
                {files.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1.5">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2 text-sm">
                        <span className="truncate text-zinc-700 dark:text-zinc-300">📎 {f.name} <span className="text-zinc-400">({humanSize(f.size)})</span></span>
                        <button type="button" onClick={() => removeFile(i)} aria-label={t("remove")}
                          className="ml-3 shrink-0 text-zinc-400 hover:text-red-500 transition-colors">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg bg-teal-600 text-white font-medium text-sm hover:bg-teal-700 transition-colors mt-1 disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? t("sending") : t("button")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
