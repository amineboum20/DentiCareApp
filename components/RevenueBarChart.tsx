"use client";

interface Props {
  data: Array<{ label: string; revenue: number }>;
}

export default function RevenueBarChart({ data }: Props) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 100);
  const niceMax = Math.ceil(maxRevenue / 1000) * 1000 || 1000;

  const chartLeft = 52;
  const chartRight = 430;
  const chartTop = 12;
  const chartBottom = 148;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;
  const groupW = chartW / data.length;
  const barW = Math.min(42, groupW * 0.65);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: niceMax * f,
    y: chartBottom - f * chartH,
    label:
      niceMax * f >= 1000
        ? `${(niceMax * f / 1000).toFixed(0)}k`
        : `${(niceMax * f).toFixed(0)}`,
  }));

  return (
    <svg viewBox="0 0 440 180" className="w-full" style={{ overflow: "visible" }}>
      {/* Grid lines + Y labels */}
      {ticks.map(({ value, y, label }, i) => (
        <g key={i}>
          <line
            x1={chartLeft} y1={y} x2={chartRight} y2={y}
            stroke="#e4e4e7" strokeWidth="1"
            strokeDasharray={i === 0 ? undefined : "3 3"}
          />
          <text x={chartLeft - 6} y={y + 3.5} textAnchor="end" fontSize="9" fill="#a1a1aa">
            {label}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const barH = Math.max((d.revenue / niceMax) * chartH, d.revenue > 0 ? 2 : 0);
        const barX = chartLeft + i * groupW + (groupW - barW) / 2;
        const barY = chartBottom - barH;
        const isEmpty = d.revenue === 0;

        return (
          <g key={i}>
            <rect
              x={barX} y={barY} width={barW} height={barH || 2}
              rx="3"
              fill={isEmpty ? "#e4e4e7" : "#3b82f6"}
            />
            {!isEmpty && (
              <text
                x={barX + barW / 2} y={barY - 4}
                textAnchor="middle" fontSize="8" fill="#6b7280"
              >
                {d.revenue >= 1000
                  ? `${(d.revenue / 1000).toFixed(1)}k`
                  : d.revenue.toFixed(0)}
              </text>
            )}
            <text
              x={barX + barW / 2} y={chartBottom + 13}
              textAnchor="middle" fontSize="9" fill="#71717a"
            >
              {d.label}
            </text>
          </g>
        );
      })}

      {/* Base line */}
      <line
        x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom}
        stroke="#d4d4d8" strokeWidth="1"
      />
    </svg>
  );
}
