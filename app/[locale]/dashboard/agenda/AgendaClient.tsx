"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export type AgendaAppointment = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number | null;
  type: string;
  status: string;
  praticien_id: string | null;
  patient_id: string | null;
  patients: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
};

interface Props {
  initialAppointments: AgendaAppointment[];
  praticiens: { id: string; name: string }[];
  defaultPraticienId?: string | null;
}

const HOUR_START = 7;
const HOUR_END = 21;
const PX_PER_HOUR = 48;
const GRID_H = (HOUR_END - HOUR_START) * PX_PER_HOUR;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

const STATUS_BLOCK: Record<string, string> = {
  planifie: "bg-teal-500/90 border-teal-600 text-white",
  termine: "bg-emerald-500/90 border-emerald-600 text-white",
  annule: "bg-red-400/80 border-red-500 text-white line-through",
  absent: "bg-amber-500/90 border-amber-600 text-white",
};

const pad = (n: number) => String(n).padStart(2, "0");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function startOfWeek(d: Date) { const x = startOfDay(d); const w = (x.getDay() + 6) % 7; return addDays(x, -w); }
const patName = (p: AgendaAppointment["patients"]) => {
  const o = Array.isArray(p) ? p[0] : p;
  return o ? `${o.first_name} ${o.last_name}` : "";
};

export default function AgendaClient({ initialAppointments, praticiens, defaultPraticienId }: Props) {
  const t = useTranslations("agenda");
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "fr";
  const intlLocale = locale === "ar" ? "ar" : locale === "en" ? "en" : "fr";

  const [anchor, setAnchor] = useState<Date | null>(null);
  const [view, setView] = useState<"week" | "day">("week");
  const [prat, setPrat] = useState<string>(defaultPraticienId ?? "all");
  useEffect(() => { setAnchor(startOfDay(new Date())); }, []);

  const pratName = useMemo(() => {
    const m = new Map(praticiens.map((p) => [p.id, p.name]));
    return (id: string | null) => (id ? m.get(id) ?? t("noPractitioner") : t("noPractitioner"));
  }, [praticiens, t]);

  const days = useMemo(() => {
    if (!anchor) return [];
    if (view === "day") return [anchor];
    const s = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [anchor, view]);

  const visible = useMemo(() =>
    initialAppointments.filter((a) => prat === "all" || a.praticien_id === prat),
    [initialAppointments, prat]);

  function apptsForDay(day: Date) {
    return visible.filter((a) => sameDay(new Date(a.scheduled_at), day));
  }

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>, day: Date) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const snapped = Math.max(0, Math.round((y / PX_PER_HOUR * 60) / 15) * 15);
    const d = new Date(day);
    d.setHours(HOUR_START + Math.floor(snapped / 60), snapped % 60, 0, 0);
    const at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const q = new URLSearchParams({ new: "1", at });
    if (prat !== "all") q.set("praticien_id", prat);
    router.push(`/${locale}/dashboard/appointments?${q.toString()}`);
  }

  const rangeLabel = useMemo(() => {
    if (!days.length) return "";
    if (view === "day") return days[0].toLocaleDateString(intlLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
    return `${days[0].toLocaleDateString(intlLocale, opts)} – ${days[6].toLocaleDateString(intlLocale, opts)}`;
  }, [days, view, intlLocale]);

  if (!anchor) return <div className="h-[60vh] animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/40" />;

  const step = view === "day" ? 1 : 7;
  const btn = "px-3 py-1.5 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white me-2">{t("title")}</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setAnchor((a) => addDays(a!, -step))} className={btn} aria-label="prev">‹</button>
          <button onClick={() => setAnchor(startOfDay(new Date()))} className={btn}>{t("today")}</button>
          <button onClick={() => setAnchor((a) => addDays(a!, step))} className={btn} aria-label="next">›</button>
        </div>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 capitalize">{rangeLabel}</span>
        <div className="ms-auto flex items-center gap-2">
          <select value={prat} onChange={(e) => setPrat(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            <option value="all">{t("allPractitioners")}</option>
            {praticiens.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <button onClick={() => setView("week")} className={`px-3 py-1.5 text-sm ${view === "week" ? "bg-teal-600 text-white" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>{t("week")}</button>
            <button onClick={() => setView("day")} className={`px-3 py-1.5 text-sm ${view === "day" ? "bg-teal-600 text-white" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>{t("day")}</button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Day headers */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const today = sameDay(day, new Date());
            return (
              <div key={day.toISOString()} className="flex-1 text-center py-2 border-s border-zinc-100 dark:border-zinc-800">
                <div className="text-[11px] uppercase text-zinc-400">{day.toLocaleDateString(intlLocale, { weekday: "short" })}</div>
                <div className={`text-sm font-semibold ${today ? "text-teal-600 dark:text-teal-400" : "text-zinc-700 dark:text-zinc-300"}`}>{day.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex overflow-x-auto">
          {/* Time axis */}
          <div className="w-14 shrink-0">
            {HOURS.map((h) => (
              <div key={h} style={{ height: PX_PER_HOUR }} className="relative">
                <span className="absolute -top-2 end-1.5 text-[10px] text-zinc-400">{pad(h)}:00</span>
              </div>
            ))}
          </div>
          {/* Day columns */}
          {days.map((day) => (
            <div
              key={day.toISOString()}
              onClick={(e) => handleGridClick(e, day)}
              className="flex-1 min-w-[110px] relative border-s border-zinc-100 dark:border-zinc-800 cursor-copy"
              style={{ height: GRID_H }}
            >
              {HOURS.map((h) => <div key={h} style={{ height: PX_PER_HOUR }} className="border-b border-zinc-50 dark:border-zinc-800/60" />)}
              <div className="absolute inset-0">
                {apptsForDay(day).map((a) => {
                  const s = new Date(a.scheduled_at);
                  const mins = (s.getHours() - HOUR_START) * 60 + s.getMinutes();
                  const dur = a.duration_minutes ?? 30;
                  const top = Math.max(0, (mins / 60) * PX_PER_HOUR);
                  const height = Math.max(18, (dur / 60) * PX_PER_HOUR);
                  return (
                    <button
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); router.push(`/${locale}/dashboard/appointments/${a.id}`); }}
                      style={{ top, height }}
                      className={`absolute inset-x-0.5 rounded-md border px-1.5 py-0.5 text-start overflow-hidden ${STATUS_BLOCK[a.status] ?? "bg-zinc-500 border-zinc-600 text-white"}`}
                      title={`${s.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })} · ${patName(a.patients) || a.title}`}
                    >
                      <div className="text-[10px] leading-tight opacity-90">{s.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="text-[11px] font-medium leading-tight truncate">{patName(a.patients) || a.title}</div>
                      {prat === "all" && <div className="text-[9px] leading-tight opacity-80 truncate">{pratName(a.praticien_id)}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
