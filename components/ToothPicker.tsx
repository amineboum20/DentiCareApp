"use client";

// Interactive odontogram used to PICK teeth (multi-select), e.g. when billing a
// tooth-scoped acte. Controlled: `value` is the list of selected FDI codes,
// `onChange` returns the next list. No DB writes — reuses the shared odontogram
// geometry from odontogram-data. Defaults to the adult chart; pass `birthDate`
// to show the deciduous (child) chart for young patients.

import {
  ADULT_PREFIX,
  ANCHORS,
  CHILD_PREFIX,
  QUADRANTS,
  VIEWBOX,
  anchorAt,
  isChildAge,
  teethPaths,
  type ToothPath,
} from "@/components/odontogram-data";

const SELECT = "#0d9488";

export default function ToothPicker({
  value,
  onChange,
  birthDate,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  birthDate?: string | null;
}) {
  const child = isChildAge(birthDate);
  const teeth: ToothPath[] = child ? teethPaths.slice(0, 5) : teethPaths;
  const prefixes = child ? CHILD_PREFIX : ADULT_PREFIX;
  const selected = new Set(value);

  function toggle(fdi: string) {
    const next = new Set(selected);
    if (next.has(fdi)) next.delete(fdi);
    else next.add(fdi);
    onChange([...next]);
  }

  return (
    <div className="w-full max-w-[210px] mx-auto">
      <svg
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        fill="none"
        className="block w-full select-none"
        style={{ height: "auto", aspectRatio: `${VIEWBOX.w} / ${VIEWBOX.h}` }}
      >
        <title>Sélection des dents</title>
        {QUADRANTS.map((q, qi) => (
          <g key={qi} transform={q.transform || undefined}>
            {teeth.map((tp) => {
              const fdi = prefixes[qi] + tp.name;
              const isSel = selected.has(fdi);
              const highlights = Array.isArray(tp.lineHighlightPath) ? tp.lineHighlightPath : [tp.lineHighlightPath];
              return (
                <g key={fdi} onClick={() => toggle(fdi)} style={{ cursor: "pointer" }}>
                  <path d={tp.shadowPath} fill={isSel ? `${SELECT}33` : "#ffffff00"} />
                  <path d={tp.outlinePath} stroke={isSel ? SELECT : "#9ca3af"} strokeWidth={isSel ? 4 : 2} strokeLinecap="round" strokeLinejoin="round" />
                  {highlights.map((d, i) => (
                    <path key={i} d={d} stroke={isSel ? SELECT : "#cbd0d8"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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
            const isSel = selected.has(fdi);
            return (
              <text
                key={`n-${fdi}`}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={17}
                fontWeight={700}
                className={isSel ? undefined : "fill-zinc-600 dark:fill-zinc-300"}
                fill={isSel ? SELECT : undefined}
                style={{ pointerEvents: "none" }}
              >
                {fdi}
              </text>
            );
          })
        )}
      </svg>
    </div>
  );
}
