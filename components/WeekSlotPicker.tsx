"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";

type MiniPatient = { first_name: string; last_name: string };
export type SlotAppointment = {
  id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  status: string;
  praticien_id: string | null;
  patients?: MiniPatient | MiniPatient[] | null;
};

interface Props {
  praticienId: string;
  appointments: SlotAppointment[];
  excludeId?: string | null;
  valueLocal: string;        // datetime-local string, or "" if none picked yet
  durationMinutes: number;
  onChange: (localDateTime: string, durationMinutes: number) => void;
}

const DAY_START = 8, DAY_END = 20, SLOT_MIN = 30, ROW_H = 20;
const SLOTS = Array.from({ length: (DAY_END - DAY_START) * 2 }, (_, i) => i); // 0..23 (30-min units)
const pad = (n: number) => String(n).padStart(2, "0");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const patName = (p: SlotAppointment["patients"]) => { const o = Array.isArray(p) ? p[0] : p; return o ? `${o.first_name} ${o.last_name}` : ""; };
const dayKeyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function WeekSlotPicker({ praticienId, appointments, excludeId, valueLocal, durationMinutes, onChange }: Props) {
  const t = useTranslations("agenda");
  const locale = useLocale();
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [pending, setPending] = useState<{ dayKey: string; slot: number } | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setAnchor(valueLocal ? startOfDay(new Date(valueLocal)) : startOfDay(new Date())); }, []);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setIsMobile(mq.matches); on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const days = useMemo(() => {
    if (!anchor) return [];
    if (isMobile) return [anchor];
    const s = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [anchor, isMobile]);

  const busy = useMemo(
    () => appointments.filter((a) => a.praticien_id === praticienId && a.status !== "annule" && (excludeId ? a.id !== excludeId : true)),
    [appointments, praticienId, excludeId]);

  function dayBusy(day: Date) {
    const set = new Set<number>();
    const labels = new Map<number, string>();
    for (const a of busy) {
      const s = new Date(a.scheduled_at);
      if (!sameDay(s, day)) continue;
      const startMin = (s.getHours() - DAY_START) * 60 + s.getMinutes();
      const dur = a.duration_minutes ?? 30;
      const startSlot = Math.floor(startMin / SLOT_MIN);
      const endSlot = Math.ceil((startMin + dur) / SLOT_MIN);
      for (let i = Math.max(0, startSlot); i < Math.min(SLOTS.length, endSlot); i++) set.add(i);
      if (startSlot >= 0 && startSlot < SLOTS.length) labels.set(startSlot, `${pad(s.getHours())}:${pad(s.getMinutes())} ${patName(a.patients)}`);
    }
    return { set, labels };
  }

  const sel = useMemo(() => {
    if (!valueLocal) return null;
    const d = new Date(valueLocal);
    const startMin = (d.getHours() - DAY_START) * 60 + d.getMinutes();
    if (startMin < 0 || d.getHours() >= DAY_END) return null;
    return { day: startOfDay(d), startSlot: Math.floor(startMin / SLOT_MIN), span: Math.max(1, Math.ceil((durationMinutes || 30) / SLOT_MIN)) };
  }, [valueLocal, durationMinutes]);

  const conflict = useMemo(() => {
    if (!sel) return false;
    const { set } = dayBusy(sel.day);
    for (let i = sel.startSlot; i < sel.startSlot + sel.span; i++) if (set.has(i)) return true;
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, busy]);

  function cellLocal(day: Date, slot: number) {
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(DAY_START + Math.floor(slot / 2))}:${pad((slot % 2) * 30)}`;
  }
  function onCell(day: Date, slot: number) {
    const key = dayKeyOf(day);
    if (pending && pending.dayKey === key && slot >= pending.slot) {
      onChange(cellLocal(day, pending.slot), (slot - pending.slot + 1) * SLOT_MIN);
      setPending(null);
    } else {
      setPending({ dayKey: key, slot });
      onChange(cellLocal(day, slot), SLOT_MIN);
    }
  }

  if (!anchor) return <div className="h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/40" />;
  const step = isMobile ? 1 : 7;
  const nav = "px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("chooseSlot")}</label>
        {conflict && <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">⚠️ {t("conflict")}</span>}
      </div>
      <div className="flex items-center gap-1 mb-1">
        <button type="button" onClick={() => setAnchor((a) => addDays(a!, -step))} className={nav} aria-label="prev">‹</button>
        <button type="button" onClick={() => setAnchor(startOfDay(new Date()))} className={nav}>{t("today")}</button>
        <button type="button" onClick={() => setAnchor((a) => addDays(a!, step))} className={nav} aria-label="next">›</button>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 ms-1 capitalize">
          {isMobile
            ? days[0].toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" })
            : `${days[0].toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString(locale, { day: "numeric", month: "short" })}`}
        </span>
      </div>
      <p className="text-[10px] text-zinc-400 mb-1">{t("slotHint")}</p>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="flex bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-10 shrink-0" />
          {days.map((d) => {
            const today = sameDay(d, new Date());
            return <div key={+d} className={`flex-1 text-center py-1 text-[10px] ${today ? "text-teal-600 dark:text-teal-400 font-semibold" : "text-zinc-500 dark:text-zinc-400"}`}>{d.toLocaleDateString(locale, { weekday: "short" })} {d.getDate()}</div>;
          })}
        </div>
        <div className="flex max-h-64 overflow-y-auto">
          <div className="w-10 shrink-0">
            {SLOTS.map((s) => <div key={s} style={{ height: ROW_H }} className="text-[9px] text-zinc-400 text-end pe-1">{s % 2 === 0 ? `${pad(DAY_START + s / 2)}:00` : ""}</div>)}
          </div>
          {days.map((day) => {
            const { set, labels } = dayBusy(day);
            const key = dayKeyOf(day);
            return (
              <div key={+day} className="flex-1 border-s border-zinc-100 dark:border-zinc-800">
                {SLOTS.map((slot) => {
                  const isBusy = set.has(slot);
                  const isSel = !!sel && sameDay(sel.day, day) && slot >= sel.startSlot && slot < sel.startSlot + sel.span;
                  const isPend = pending?.dayKey === key && pending?.slot === slot;
                  const label = labels.get(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onCell(day, slot)}
                      style={{ height: ROW_H }}
                      title={label || ""}
                      className={`w-full block text-[8px] leading-none px-0.5 truncate text-start border-b ${slot % 2 === 0 ? "border-zinc-100 dark:border-zinc-800" : "border-transparent"} ${
                        isSel ? (conflict ? "bg-amber-400/80 text-white" : "bg-teal-500/80 text-white")
                          : isBusy ? "bg-zinc-300/70 dark:bg-zinc-600/60 text-zinc-600 dark:text-zinc-200"
                            : "hover:bg-teal-50 dark:hover:bg-teal-900/20"
                      } ${isPend ? "ring-1 ring-inset ring-teal-500" : ""}`}
                    >
                      {label || ""}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
