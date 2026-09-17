"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useRef, useState } from "react";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

export interface TicketRow {
  id: string;
  subject: string;
  status: string;
  last_message_at: string;
  created_at: string;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("support");
  const map: Record<string, string> = {
    open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    answered: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    closed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  };
  const label: Record<string, string> = {
    open: t("statusOpen"), answered: t("statusAnswered"), closed: t("statusClosed"),
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? ""}`}>{label[status] ?? status}</span>;
}

export default function SupportClient({ tickets }: { tickets: TicketRow[] }) {
  const t = useTranslations("support");
  const router = useRouter();
  const [composing, setComposing] = useState(tickets.length === 0);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const f of Array.from(list)) if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    if (next.length > MAX_FILES) { setError(t("tooManyFiles", { max: MAX_FILES })); return; }
    if (next.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) { setError(t("tooLarge")); return; }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("message", message);
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/support", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ticketId) throw new Error("failed");
      router.push(`/dashboard/support/${json.ticketId}`);
    } catch {
      setError(t("error")); setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        {!composing && (
          <button onClick={() => setComposing(true)}
            className="text-sm font-medium bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors">
            {t("newTicket")}
          </button>
        )}
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t("subtitle")}</p>

      {composing && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8 mb-6">
          <h2 className="font-semibold text-zinc-900 dark:text-white mb-4">{t("newTicket")}</h2>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("subject")}</label>
              <input type="text" placeholder={t("subjectPlaceholder")} value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("message")}</label>
              <textarea placeholder={t("messagePlaceholder")} value={message} rows={5} onChange={e => setMessage(e.target.value)} required
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
                      <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} aria-label={t("remove")}
                        className="ml-3 shrink-0 text-zinc-400 hover:text-red-500 transition-colors">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={loading}
                className="py-2.5 px-6 rounded-lg bg-teal-600 text-white font-medium text-sm hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? t("sending") : t("button")}
              </button>
              {tickets.length > 0 && (
                <button type="button" onClick={() => setComposing(false)}
                  className="py-2.5 px-4 rounded-lg text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                  {t("cancel")}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {tickets.length > 0 && (
        <div className="flex flex-col gap-2">
          {tickets.map((tk) => (
            <Link key={tk.id} href={`/dashboard/support/${tk.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-teal-300 dark:hover:border-teal-800 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{tk.subject || t("noSubject")}</p>
                <p className="text-xs text-zinc-400">{new Date(tk.last_message_at).toLocaleDateString("fr-FR")}</p>
              </div>
              <StatusBadge status={tk.status} />
            </Link>
          ))}
        </div>
      )}

      {tickets.length === 0 && !composing && (
        <p className="text-sm text-zinc-400 text-center py-10">{t("noTickets")}</p>
      )}
    </div>
  );
}
