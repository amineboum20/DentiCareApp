import type { ReactNode } from "react";

export function DR({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex gap-3 py-0.5">
      <span className="text-xs text-zinc-400 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-zinc-800 dark:text-zinc-200">
        {typeof value === "string" || typeof value === "number" ? String(value) : value}
      </span>
    </div>
  );
}
