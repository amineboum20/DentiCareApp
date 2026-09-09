"use client";

// Odontogram (schéma dentaire) — per-patient dental chart with anatomical teeth
// laid out as upper/lower jaws (FDI numbering). Adult vs deciduous (child) is
// chosen automatically from the patient's age; child records are kept in the DB
// and are not transposed onto the adult chart when the patient grows up.

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { useAppContext } from "@/components/AppContext";
import {
  ADULT_PREFIX,
  ANCHORS,
  CHILD_PREFIX,
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

const SELECT = "#0d9488";

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

  const child = isChildAge(birthDate);
  const teeth: ToothPath[] = child ? teethPaths.slice(0, 5) : teethPaths;
  const prefixes = child ? CHILD_PREFIX : ADULT_PREFIX;

  function selectTooth(fdi: string) {
    setSel(fdi);
    setNote(chart[fdi]?.note ?? "");
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
            user_id: currentUserId,
            created_by: currentUserId,
            updated_by: currentUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "patient_id,tooth" }
        );
        setChart((c) => ({ ...c, [tooth]: { tooth, status, note: noteVal } }));
      }
    } finally {
      setBusy(false);
    }
  }

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
            </div>
          ) : (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-4">{t("selectHint")}</p>
          )}

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {STATUS_KEYS.map((key) => (
              <span key={key} className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="h-3 w-3 rounded-sm border-2 shrink-0" style={{ borderColor: STATUS_COLORS[key], backgroundColor: `${STATUS_COLORS[key]}22` }} />
                {t(`status.${key}`)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
