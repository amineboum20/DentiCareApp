"use client";

import { useState, useRef, useEffect, useMemo } from "react";

export interface SSOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SSOption[];
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** When set, a clearable row with an empty value is offered (e.g. "— Aucun —"). */
  noneLabel?: string;
  /** Placeholder shown in the input while typing to filter. */
  searchPlaceholder?: string;
  /** Shown when the query matches no option. */
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A type-to-filter select. Behaves like a native <select> (value/onChange,
 * optional empty "none" choice) but the option list narrows as you type — for
 * pickers whose list can grow large (patients, dossiers…).
 */
export default function SearchableSelect({
  value, onChange, options, placeholder, noneLabel, searchPlaceholder, emptyLabel, disabled, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        disabled={disabled}
        value={open ? query : (selected?.label ?? "")}
        placeholder={open ? (searchPlaceholder ?? placeholder ?? "") : (placeholder ?? "")}
        onFocus={() => { if (!disabled) setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        className={className}
        autoComplete="off"
      />
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg">
          {noneLabel != null && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick("")}
              className="w-full text-start px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              {noneLabel}
            </button>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
              className={`w-full text-start px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                o.value === value
                  ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300"
                  : "text-zinc-800 dark:text-zinc-200"
              }`}
            >
              {o.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-400">{emptyLabel ?? "—"}</div>
          )}
        </div>
      )}
    </div>
  );
}
