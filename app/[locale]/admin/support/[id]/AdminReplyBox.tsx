"use client";

import { useRouter } from "@/i18n/navigation";
import { useRef, useState } from "react";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

export default function AdminReplyBox({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const f of Array.from(list)) if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    if (next.length > MAX_FILES) { setError(`${MAX_FILES} fichiers maximum.`); return; }
    if (next.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) { setError("Les pièces jointes dépassent 15 Mo."); return; }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const fd = new FormData();
      fd.append("message", message);
      files.forEach((f) => fd.append("files", f));
      const res = await fetch(`/api/admin/support/${ticketId}/reply`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("failed");
      setMessage(""); setFiles([]);
      router.refresh();
    } catch {
      setError("Échec de l'envoi. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(action: "close" | "reopen") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setError("Échec. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-6">
      {status === "closed" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span>Ce ticket est fermé.</span>
          <button onClick={() => setStatus("reopen")} disabled={busy}
            className="shrink-0 text-teal-600 font-medium hover:underline disabled:opacity-60">Rouvrir</button>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <form onSubmit={sendReply} className="flex flex-col gap-3">
        <textarea placeholder="Votre réponse au cabinet…" value={message} rows={4} onChange={e => setMessage(e.target.value)} required
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition resize-y" />
        <input ref={inputRef} type="file" multiple onChange={e => addFiles(e.target.files)}
          className="block w-full text-sm text-zinc-500 dark:text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 dark:file:bg-teal-900/30 file:px-4 file:py-2 file:text-sm file:font-medium file:text-teal-700 dark:file:text-teal-300 hover:file:bg-teal-100 dark:hover:file:bg-teal-900/50 file:cursor-pointer" />
        {files.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2 text-sm">
                <span className="truncate text-zinc-700 dark:text-zinc-300">📎 {f.name}</span>
                <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} aria-label="Retirer"
                  className="ml-3 shrink-0 text-zinc-400 hover:text-red-500 transition-colors">✕</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading}
            className="py-2.5 px-6 rounded-lg bg-teal-600 text-white font-medium text-sm hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? "Envoi…" : "Répondre"}
          </button>
          {status !== "closed" && (
            <button type="button" onClick={() => setStatus("close")} disabled={busy}
              className="py-2.5 px-4 rounded-lg text-sm text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-60">
              Fermer le ticket
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
