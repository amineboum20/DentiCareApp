"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/client";

type PatientR = { id: string; first_name: string; last_name: string; phone: string | null };
type TraitementR = { id: string; name: string; category: string };
type ApptR   = { id: string; title: string; scheduled_at: string };

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<PatientR[]>([]);
  const [traitements, setTraitements] = useState<TraitementR[]>([]);
  const [appts, setAppts] = useState<ApptR[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    }
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setPatients([]); setTraitements([]); setAppts([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      setOpen(true);
      const [p, tr, a] = await Promise.all([
        supabase.from("patients").select("id, first_name, last_name, phone")
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`).limit(5),
        supabase.from("traitements").select("id, name, category")
          .ilike("name", `%${q}%`).limit(3),
        supabase.from("appointments").select("id, title, scheduled_at")
          .ilike("title", `%${q}%`).limit(3),
      ]);
      setPatients(p.data ?? []);
      setTraitements(tr.data ?? []);
      setAppts(a.data ?? []);
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const total = patients.length + traitements.length + appts.length;

  function go(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path as "/dashboard/patients");
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 h-10">
        <span className="text-zinc-400 text-sm shrink-0">🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher patients, traitements, rendez-vous…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none min-w-0"
        />
        {query ? (
          <button onClick={() => { setQuery(""); setOpen(false); }} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none shrink-0">×</button>
        ) : (
          <kbd className="hidden lg:inline text-[10px] border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-0.5 text-zinc-400 shrink-0">⌘K</kbd>
        )}
      </div>

      {open && total > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden z-50">
          {patients.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-4 pt-3 pb-1">Patients</p>
              {patients.map((p) => (
                <button key={p.id} onClick={() => go(`/dashboard/patients?detail=${p.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-start transition-colors">
                  <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 dark:text-teal-400 text-xs font-bold shrink-0">
                    {p.first_name[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{p.first_name} {p.last_name}</p>
                    {p.phone && <p className="text-xs text-zinc-400 truncate">{p.phone}</p>}
                  </div>
                </button>
              ))}
            </>
          )}
          {traitements.length > 0 && (
            <>
              {patients.length > 0 && <div className="border-t border-zinc-100 dark:border-zinc-800" />}
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-4 pt-3 pb-1">Traitements</p>
              {traitements.map((tr) => (
                <button key={tr.id} onClick={() => go(`/dashboard/traitements?detail=${tr.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-start transition-colors">
                  <span className="text-base">🦷</span>
                  <p className="text-sm text-zinc-900 dark:text-white">{tr.name}</p>
                </button>
              ))}
            </>
          )}
          {appts.length > 0 && (
            <>
              {(patients.length > 0 || traitements.length > 0) && <div className="border-t border-zinc-100 dark:border-zinc-800" />}
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-4 pt-3 pb-1">Rendez-vous</p>
              {appts.map((a) => (
                <button key={a.id} onClick={() => go(`/dashboard/appointments?detail=${a.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-start transition-colors">
                  <span className="text-base">📅</span>
                  <div>
                    <p className="text-sm text-zinc-900 dark:text-white">{a.title}</p>
                    <p className="text-xs text-zinc-400">{new Date(a.scheduled_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </button>
              ))}
            </>
          )}
          <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-2 flex gap-4">
            {([
              { href: "/dashboard/patients", label: "Patients", icon: "👤" },
              { href: "/dashboard/factures", label: "Factures", icon: "🧾" },
            ] as const).map((l) => (
              <button key={l.href} onClick={() => go(l.href)}
                className="text-[10px] text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
                {l.icon} {l.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {open && query.trim() && total === 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 py-6 z-50">
          <p className="text-sm text-zinc-400 text-center">Aucun résultat pour « {query} »</p>
        </div>
      )}
    </div>
  );
}
