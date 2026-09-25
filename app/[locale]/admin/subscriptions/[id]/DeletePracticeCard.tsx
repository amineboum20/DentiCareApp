"use client";

// Zone dangereuse: permanently delete the shop / cabinet and everything it owns
// (data, files, member accounts). The admin must retype the exact name.

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deletePracticePermanently } from "../actions";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending}
      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium">
      {pending ? "Suppression…" : "Supprimer définitivement"}
    </button>
  );
}

export default function DeletePracticeCard({ practiceId, practiceName, summary }: {
  practiceId: string;
  practiceName: string;
  summary: { label: string; count: number }[] | null;
}) {
  const [typed, setTyped] = useState("");
  // A nameless practice is confirmed by typing SUPPRIMER (same rule server-side).
  const expected = practiceName.trim() || "SUPPRIMER";
  return (
    <form action={deletePracticePermanently} id="danger"
      className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 p-5">
      <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Zone dangereuse — supprimer définitivement</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
        Supprime <strong>tout</strong> : les données, les fichiers stockés et les comptes des membres (leurs emails pourront resservir).
        Une <strong>archive complète</strong> (données, comptes, fichiers) est d&apos;abord enregistrée dans 🗄️ Archives ; si l&apos;archivage échoue, rien n&apos;est supprimé.
      </p>
      {summary ? (
        <ul className="flex flex-wrap gap-2 mb-4">
          {summary.map((s) => (
            <li key={s.label} className="text-xs px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-red-100 dark:border-red-900/40 text-zinc-700 dark:text-zinc-300">
              {s.count} {s.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-amber-600 mb-4">Impossible de calculer ce qui sera supprimé.</p>
      )}
      <input type="hidden" name="practice_id" value={practiceId} />
      <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
        Pour confirmer, tapez le nom exact : <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{expected}</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <input name="confirm_name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white" />
        <SubmitButton disabled={typed.trim() !== expected} />
      </div>
    </form>
  );
}
