"use client";

import { useMemo, useState } from "react";
import type { TestModule } from "./data";

export interface ResultRow {
  test_id: string;
  result: "pass" | "fail" | "skip";
  updated_by: string | null;
  note: string | null;
  updated_at: string | null;
}

const RESULT_META: Record<string, { label: string; badge: string; dot: string }> = {
  pass: { label: "Réussi", badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", dot: "bg-green-500" },
  fail: { label: "Échec", badge: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
  skip: { label: "Ignoré", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dot: "bg-amber-500" },
};

export default function TestsClient({ modules, initialResults }: { modules: TestModule[]; initialResults: Record<string, ResultRow> }) {
  const [results, setResults] = useState<Record<string, ResultRow>>(initialResults);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const allTests = useMemo(() => modules.flatMap((m) => m.tests), [modules]);
  const total = allTests.length;
  const counts = useMemo(() => {
    let pass = 0, fail = 0, skip = 0;
    for (const t of allTests) {
      const r = results[t.id]?.result;
      if (r === "pass") pass++; else if (r === "fail") fail++; else if (r === "skip") skip++;
    }
    return { pass, fail, skip, done: pass + fail + skip };
  }, [allTests, results]);
  const pct = total ? Math.round((counts.done / total) * 100) : 0;

  async function mark(testId: string, result: "pass" | "fail" | "skip") {
    const current = results[testId]?.result;
    const next = current === result ? null : result; // toggle off if same
    setBusy(testId);
    // optimistic
    setResults((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[testId];
      else copy[testId] = { test_id: testId, result: next, updated_by: "…", note: copy[testId]?.note ?? null, updated_at: new Date().toISOString() };
      return copy;
    });
    try {
      const res = await fetch("/api/admin/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, result: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      // rollback on error
      setResults((prev) => {
        const copy = { ...prev };
        if (current) copy[testId] = { test_id: testId, result: current, updated_by: prev[testId]?.updated_by ?? null, note: prev[testId]?.note ?? null, updated_at: prev[testId]?.updated_at ?? null };
        else delete copy[testId];
        return copy;
      });
    } finally {
      setBusy(null);
    }
  }

  const btn = (active: boolean, kind: "pass" | "fail" | "skip") => {
    const base = "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50";
    if (!active) return `${base} border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800`;
    if (kind === "pass") return `${base} border-green-600 bg-green-600 text-white`;
    if (kind === "fail") return `${base} border-red-600 bg-red-600 text-white`;
    return `${base} border-amber-500 bg-amber-500 text-white`;
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Tests</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Recette manuelle de l&apos;application — coche chaque cas.</p>

        {/* Stats */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-semibold text-zinc-900 dark:text-white">{counts.done}/{total} testés</span>
              <span className="text-green-600 dark:text-green-400">✓ {counts.pass}</span>
              <span className="text-red-600 dark:text-red-400">✕ {counts.fail}</span>
              <span className="text-amber-600 dark:text-amber-400">◦ {counts.skip}</span>
            </div>
            <span className="text-sm font-semibold text-zinc-500">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Modules */}
        <div className="flex flex-col gap-6">
          {modules.map((m) => {
            const done = m.tests.filter((t) => results[t.id]).length;
            return (
              <section key={m.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{m.icon}</span>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{m.title}</h2>
                  <span className="text-xs text-zinc-400">{done}/{m.tests.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {m.tests.map((t) => {
                    const r = results[t.id];
                    const meta = r ? RESULT_META[r.result] : null;
                    const isOpen = open === t.id;
                    return (
                      <div key={t.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <span className="text-[11px] font-mono text-teal-600 dark:text-teal-400 shrink-0">{t.id}</span>
                          <button onClick={() => setOpen(isOpen ? null : t.id)} className="flex-1 text-left min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{t.title}</p>
                            {r && (
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {r.updated_by ?? "—"}
                                {r.updated_at ? ` · ${new Date(r.updated_at).toLocaleDateString("fr-FR")}` : ""}
                              </p>
                            )}
                          </button>
                          {meta && <span className={`shrink-0 hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>{meta.label}</span>}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button disabled={busy === t.id} onClick={() => mark(t.id, "pass")} className={btn(r?.result === "pass", "pass")}>✓</button>
                            <button disabled={busy === t.id} onClick={() => mark(t.id, "fail")} className={btn(r?.result === "fail", "fail")}>✕</button>
                            <button disabled={busy === t.id} onClick={() => mark(t.id, "skip")} className={btn(r?.result === "skip", "skip")}>◦</button>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mt-3 mb-1">Étapes</p>
                            <ol className="list-decimal list-inside text-zinc-600 dark:text-zinc-300 space-y-0.5">
                              {t.steps.map((s, i) => <li key={i}>{s}</li>)}
                            </ol>
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mt-3 mb-1">Résultat attendu</p>
                            <p className="text-zinc-600 dark:text-zinc-300">{t.expected}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
