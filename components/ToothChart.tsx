"use client";

// Odontogram (schéma dentaire) — per-patient dental chart with anatomical teeth
// laid out as upper/lower jaws (FDI numbering). Adult vs deciduous (child) is
// chosen automatically from the patient's age; child records are kept in the DB
// and are not transposed onto the adult chart when the patient grows up.
//
// Besides the current state (tooth_chart) it shows, per tooth:
//  - planned care ("soins prévus", tooth_plan) — drawn as a dashed outline;
//    completed automatically when that acte is billed on that tooth;
//  - the change history (tooth_history, written by a DB trigger).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { useAppContext, useMemberName } from "@/components/AppContext";
import LocalInstant from "@/components/LocalInstant";
import { toothStatusForActe } from "@/utils/billing";
import {
  ADULT_PREFIX,
  ANCHORS,
  CHILD_PREFIX,
  PLAN_COLOR,
  PLAN_DASH,
  QUADRANTS,
  STATUS_COLORS,
  STATUS_KEYS,
  VIEWBOX,
  anchorAt,
  isChildAge,
  teethPaths,
  type ToothPath,
} from "@/components/odontogram-data";

export interface ToothRow {
  tooth: string;
  status: string;
  note: string | null;
}

interface PlanRow {
  id: string;
  tooth: string;
  acte_id: string | null;
  label: string;
  note: string | null;
  status: "planned" | "done" | "cancelled";
  planned_at: string;
  done_at: string | null;
}

interface HistoryRow {
  id: string;
  tooth: string;
  status: string | null;
  previous_status: string | null;
  note: string | null;
  acte_name: string | null;
  changed_by: string | null;
  changed_at: string;
}

interface ActeLite { id: string; name: string; category: string | null; tooth_status: string | null; scope: string | null }

const SELECT = "#0d9488";

function fmtDay(iso: string) {
  return new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function Who({ userId }: { userId: string | null }) {
  const t = useTranslations("toothChart");
  const name = useMemberName(userId);
  return name ? <> · {t("history.by", { name })}</> : null;
}

export default function ToothChart({
  patientId,
  initial,
  birthDate,
}: {
  patientId: string;
  initial: ToothRow[];
  birthDate: string | null;
}) {
  const t = useTranslations("toothChart");
  const supabase = useMemo(() => createClient(), []);
  const { practiceId, currentUserId, memberRole } = useAppContext();
  // Assistants (front-desk) may view the dental chart but not edit it — clinical.
  const readOnly = memberRole === "assistant";

  const [chart, setChart] = useState<Record<string, ToothRow>>(() =>
    Object.fromEntries(initial.map((r) => [r.tooth, r]))
  );
  // `initial` arrives asynchronously (fetched after mount) — sync it in when it loads.
  useEffect(() => {
    setChart(Object.fromEntries(initial.map((r) => [r.tooth, r])));
  }, [initial]);
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [actes, setActes] = useState<ActeLite[]>([]);
  const [planActe, setPlanActe] = useState("");
  const [planNote, setPlanNote] = useState("");

  const loadPlans = useCallback(async () => {
    const { data } = await supabase.from("tooth_plan")
      .select("id, tooth, acte_id, label, note, status, planned_at, done_at")
      .eq("patient_id", patientId).order("planned_at", { ascending: false });
    setPlans((data ?? []) as PlanRow[]);
  }, [supabase, patientId]);
  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from("tooth_history")
      .select("id, tooth, status, previous_status, note, acte_name, changed_by, changed_at")
      .eq("patient_id", patientId).order("changed_at", { ascending: false }).limit(500);
    setHistory((data ?? []) as HistoryRow[]);
  }, [supabase, patientId]);

  useEffect(() => { loadPlans(); loadHistory(); }, [loadPlans, loadHistory]);
  useEffect(() => {
    if (readOnly) return;
    supabase.from("actes").select("id, name, category, tooth_status, scope").order("name")
      .then(({ data }) => setActes((data ?? []) as ActeLite[]));
  }, [supabase, readOnly]);

  const plannedTeeth = useMemo(() => new Set(plans.filter((p) => p.status === "planned").map((p) => p.tooth)), [plans]);
  const openPlans = useMemo(() => plans.filter((p) => p.status === "planned"), [plans]);

  const child = isChildAge(birthDate);
  const teeth: ToothPath[] = child ? teethPaths.slice(0, 5) : teethPaths;
  const prefixes = child ? CHILD_PREFIX : ADULT_PREFIX;

  function selectTooth(fdi: string) {
    setSel(fdi);
    setNote(chart[fdi]?.note ?? "");
    setPlanActe(""); setPlanNote("");
  }

  async function apply(status: string | null) {
    if (!sel || readOnly) return;
    const tooth = sel;
    setBusy(true);
    try {
      if (!status) {
        await supabase.from("tooth_chart").delete().eq("patient_id", patientId).eq("tooth", tooth);
        setChart((c) => {
          const n = { ...c };
          delete n[tooth];
          return n;
        });
      } else {
        const noteVal = note.trim() || null;
        await supabase.from("tooth_chart").upsert(
          {
            practice_id: practiceId,
            patient_id: patientId,
            tooth,
            status,
            note: noteVal,
            source_acte_id: null, // manual edit — not from an acte
            user_id: currentUserId,
            created_by: currentUserId,
            updated_by: currentUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "patient_id,tooth" }
        );
        setChart((c) => ({ ...c, [tooth]: { tooth, status, note: noteVal } }));
      }
      await loadHistory();
    } finally {
      setBusy(false);
    }
  }

  async function addPlan() {
    if (!sel || readOnly || !planActe) return;
    const acte = actes.find((a) => a.id === planActe);
    if (!acte) return;
    setBusy(true);
    try {
      await supabase.from("tooth_plan").insert({
        practice_id: practiceId, patient_id: patientId, tooth: sel,
        acte_id: acte.id, label: acte.name, note: planNote.trim() || null,
        created_by: currentUserId, updated_by: currentUserId,
      });
      setPlanActe(""); setPlanNote("");
      await loadPlans();
    } finally {
      setBusy(false);
    }
  }

  // Done by hand (without billing): close the plan and, if the acte changes a
  // tooth's state, reflect it on the chart like billing would.
  async function markDone(p: PlanRow) {
    if (readOnly) return;
    setBusy(true);
    try {
      await supabase.from("tooth_plan").update({ status: "done", done_at: new Date().toISOString() }).eq("id", p.id);
      const acte = actes.find((a) => a.id === p.acte_id);
      const status = acte ? toothStatusForActe(acte) : undefined;
      if (acte && status) {
        await supabase.from("tooth_chart").upsert({
          practice_id: practiceId, patient_id: patientId, tooth: p.tooth, status,
          note: chart[p.tooth]?.note ?? null, source_acte_id: acte.id,
          user_id: currentUserId, created_by: currentUserId, updated_by: currentUserId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "patient_id,tooth" });
        setChart((c) => ({ ...c, [p.tooth]: { tooth: p.tooth, status, note: c[p.tooth]?.note ?? null } }));
        await loadHistory();
      }
      await loadPlans();
    } finally {
      setBusy(false);
    }
  }

  async function cancelPlan(p: PlanRow) {
    if (readOnly) return;
    setBusy(true);
    try {
      await supabase.from("tooth_plan").update({ status: "cancelled" }).eq("id", p.id);
      await loadPlans();
    } finally {
      setBusy(false);
    }
  }

  const selPlans = sel ? plans.filter((p) => p.tooth === sel) : [];
  const selHistory = sel ? history.filter((h) => h.tooth === sel) : [];
  const statusLabel = (s: string | null) => (s ? (t.has(`status.${s}`) ? t(`status.${s}`) : s) : t("history.cleared"));
  const inputCls = "w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">🦷 {t("title")}</h2>
        <span className="text-[11px] text-zinc-400">{t(child ? "child" : "adult")}</span>
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:items-start">
        {/* Chart */}
        <div className="w-full max-w-[250px] mx-auto md:mx-0 shrink-0">
          <svg viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`} fill="none" className="w-full h-auto select-none">
            <title>Odontogram</title>
            {QUADRANTS.map((q, qi) => (
              <g key={qi} transform={q.transform || undefined}>
                {teeth.map((tp) => {
                  const fdi = prefixes[qi] + tp.name;
                  const st = chart[fdi]?.status;
                  const col = st ? STATUS_COLORS[st] : undefined;
                  const isSel = sel === fdi;
                  const stroke = isSel ? SELECT : col ?? "#9ca3af";
                  const highlights = Array.isArray(tp.lineHighlightPath) ? tp.lineHighlightPath : [tp.lineHighlightPath];
                  return (
                    <g key={fdi} onClick={() => selectTooth(fdi)} style={{ cursor: "pointer" }}>
                      <path d={tp.shadowPath} fill={col ? `${col}33` : "#ffffff00"} />
                      <path d={tp.outlinePath} stroke={stroke} strokeWidth={isSel ? 4 : 2} strokeLinecap="round" strokeLinejoin="round" />
                      {highlights.map((d, i) => (
                        <path key={i} d={d} stroke={col ?? "#cbd0d8"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      ))}
                      {plannedTeeth.has(fdi) && (
                        <path d={tp.shadowPath} stroke={PLAN_COLOR} strokeWidth={3} strokeDasharray={PLAN_DASH} strokeLinejoin="round" />
                      )}
                    </g>
                  );
                })}
              </g>
            ))}
            {QUADRANTS.map((_, qi) =>
              teeth.map((tp) => {
                const fdi = prefixes[qi] + tp.name;
                const p = anchorAt(qi, ANCHORS[tp.name]);
                const active = !!chart[fdi];
                return (
                  <text
                    key={`n-${fdi}`}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={17}
                    fontWeight={700}
                    className={active ? undefined : "fill-zinc-700 dark:fill-zinc-200"}
                    fill={active ? STATUS_COLORS[chart[fdi].status] : undefined}
                    style={{ pointerEvents: "none" }}
                  >
                    {fdi}
                  </text>
                );
              })
            )}
          </svg>
        </div>

        {/* Options + legend on the side */}
        <div className="flex-1 min-w-0">
          {sel ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t("toothLabel", { tooth: sel })}</p>
                <button onClick={() => setSel(null)} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">✕</button>
              </div>
              {readOnly ? (
                chart[sel] ? (
                  <div>
                    <span
                      className="inline-block px-2.5 py-1 rounded-lg border-2 text-xs font-medium"
                      style={{ borderColor: STATUS_COLORS[chart[sel].status], backgroundColor: STATUS_COLORS[chart[sel].status], color: "#fff" }}
                    >
                      {t(`status.${chart[sel].status}`)}
                    </span>
                    {chart[sel].note && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">{chart[sel].note}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">—</p>
                )
              ) : (
              <>
              <div className="flex flex-wrap gap-2 mb-3">
                {STATUS_KEYS.map((key) => {
                  const color = STATUS_COLORS[key];
                  const active = chart[sel]?.status === key;
                  return (
                    <button
                      key={key}
                      disabled={busy}
                      onClick={() => apply(key)}
                      className="px-2.5 py-1 rounded-lg border-2 text-xs font-medium transition-all disabled:opacity-50"
                      style={{ borderColor: color, backgroundColor: active ? color : `${color}18`, color: active ? "#fff" : color }}
                    >
                      {t(`status.${key}`)}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("notePlaceholder")}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {chart[sel] && (
                  <button
                    disabled={busy}
                    onClick={() => apply(null)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {t("clear")}
                  </button>
                )}
              </div>
              </>
              )}

              {/* Planned care for this tooth */}
              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">{t("plan.title")}</p>
                {selPlans.length === 0 ? (
                  <p className="text-xs text-zinc-400 mb-2">{t("plan.empty")}</p>
                ) : (
                  <ul className="space-y-1.5 mb-2">
                    {selPlans.map((p) => (
                      <li key={p.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${p.status === "planned" ? "bg-amber-50 dark:bg-amber-900/15 border border-dashed border-amber-400" : "bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"}`}>
                        <div className="flex-1 min-w-0">
                          <p className={`truncate ${p.status === "cancelled" ? "line-through text-zinc-400" : "text-zinc-800 dark:text-zinc-100"}`}>{p.label}</p>
                          <p className="text-[11px] text-zinc-400">
                            {p.status === "done" && p.done_at
                              ? t("plan.doneOn", { date: fmtDay(p.done_at) })
                              : p.status === "cancelled" ? t("plan.cancelled") : t("plan.plannedOn", { date: fmtDay(p.planned_at) })}
                            {p.note ? ` · ${p.note}` : ""}
                          </p>
                        </div>
                        {p.status === "planned" && !readOnly && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button disabled={busy} onClick={() => markDone(p)} className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium disabled:opacity-50">✓ {t("plan.markDone")}</button>
                            <button disabled={busy} onClick={() => cancelPlan(p)} title={t("plan.cancel")} className="px-2 py-1 rounded-md text-zinc-400 hover:text-red-500 text-xs disabled:opacity-50">✕</button>
                          </div>
                        )}
                        {p.status === "done" && <span className="shrink-0 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">✓ {t("plan.done")}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {!readOnly && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select value={planActe} onChange={(e) => setPlanActe(e.target.value)} className={`sm:flex-1 ${inputCls}`}>
                      <option value="">{t("plan.chooseActe")}</option>
                      {actes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <input value={planNote} onChange={(e) => setPlanNote(e.target.value)} placeholder={t("plan.notePlaceholder")} className={`sm:flex-1 ${inputCls}`} />
                    <button disabled={busy || !planActe} onClick={addPlan} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium disabled:opacity-50 shrink-0">+ {t("plan.add")}</button>
                  </div>
                )}
              </div>

              {/* History for this tooth */}
              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">{t("history.title")}</p>
                {selHistory.length === 0 ? (
                  <p className="text-xs text-zinc-400">{t("history.empty")}</p>
                ) : (
                  <ol className="space-y-1.5 max-h-56 overflow-y-auto">
                    {selHistory.map((h) => (
                      <li key={h.id} className="flex items-start gap-2 text-xs">
                        <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: h.status ? STATUS_COLORS[h.status] ?? "#a1a1aa" : "#a1a1aa" }} />
                        <div className="min-w-0">
                          <p className="text-zinc-700 dark:text-zinc-200">
                            {h.previous_status && h.previous_status !== h.status
                              ? <>{statusLabel(h.previous_status)} → <strong>{statusLabel(h.status)}</strong></>
                              : <strong>{statusLabel(h.status)}</strong>}
                            {h.acte_name && <span className="text-zinc-400"> · {t("history.viaActe", { acte: h.acte_name })}</span>}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            <LocalInstant iso={h.changed_at} options={{ day: "numeric", month: "short", year: "numeric" }} />
                            <Who userId={h.changed_by} />
                            {h.note ? ` · ${h.note}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-4">{t("selectHint")}</p>
          )}

          {/* Whole-mouth treatment plan */}
          {openPlans.length > 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-amber-400 bg-amber-50/60 dark:bg-amber-900/10 p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">{t("plan.summary", { count: openPlans.length })}</p>
              <ul className="space-y-1">
                {openPlans.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => selectTooth(p.tooth)} className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300 hover:text-teal-600 dark:hover:text-teal-400">
                      <span className="font-semibold">{p.tooth}</span> · {p.label} <span className="text-zinc-400">· {fmtDay(p.planned_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {STATUS_KEYS.map((key) => (
              <span key={key} className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="h-3 w-3 rounded-sm border-2 shrink-0" style={{ borderColor: STATUS_COLORS[key], backgroundColor: `${STATUS_COLORS[key]}22` }} />
                {t(`status.${key}`)}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="h-3 w-3 rounded-sm border-2 border-dashed shrink-0" style={{ borderColor: PLAN_COLOR }} />
              {t("plan.legend")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
