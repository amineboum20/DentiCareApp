"use client";

const STATUSES = [
  { key: "delivered",   label: "Livrée",     color: "#a1a1aa" },
  { key: "ready",       label: "Prête",       color: "#10b981" },
  { key: "in_progress", label: "En cours",    color: "#3b82f6" },
  { key: "pending",     label: "En attente",  color: "#f59e0b" },
  { key: "cancelled",   label: "Annulée",     color: "#ef4444" },
];

interface Props {
  counts: Record<string, number>;
}

export default function StatusDonutChart({ counts }: Props) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-zinc-400 text-center py-8">Aucune commande</p>
    );
  }

  const r = 40;
  const cx = 55;
  const cy = 55;
  const C = 2 * Math.PI * r;

  let cumulative = 0;
  const segments = STATUSES.map((s) => {
    const count = counts[s.key] ?? 0;
    const portion = (count / total) * C;
    const startAngle = -90 + (cumulative / total) * 360;
    cumulative += count;
    return { ...s, count, portion, startAngle };
  }).filter((s) => s.count > 0);

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {/* Donut */}
      <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
        <svg viewBox="0 0 110 110" width="110" height="110">
          {/* Background ring */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f4f4f5" strokeWidth="18" />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${seg.portion} ${C - seg.portion}`}
              transform={`rotate(${seg.startAngle}, ${cx}, ${cy})`}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-zinc-900 dark:text-white leading-none">{total}</span>
          <span className="text-xs text-zinc-400">total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2 min-w-[140px]">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-400 flex-1">{seg.label}</span>
            <span className="text-xs font-semibold text-zinc-900 dark:text-white ml-2">
              {seg.count}
            </span>
            <span className="text-xs text-zinc-400 w-10 text-right">
              {((seg.count / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
