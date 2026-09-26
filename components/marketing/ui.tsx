import type { ReactNode } from "react";

// Building blocks of the public site (MediCareApp look). Server- and client-safe.
export const CONTAINER = "max-w-[1160px] mx-auto px-5";
export const BTN = "inline-flex items-center justify-center px-[22px] py-[13px] rounded-xl font-semibold transition hover:-translate-y-px";
export const BTN_PRIMARY = `${BTN} v2-grad text-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.45)]`;
export const BTN_GHOST = `${BTN} border border-slate-200 bg-white text-slate-900`;
export const CARD = "bg-white border border-slate-200 rounded-[18px] p-[26px]";
export const ICON_TILE = "v2-tint w-[52px] h-[52px] rounded-[14px] grid place-items-center text-[1.6rem] mb-4";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="v2-grad-text inline-block mb-3 text-[0.8rem] font-bold uppercase tracking-[0.08em] rtl:tracking-normal">{children}</span>;
}

export function SectionHead({ eyebrow, title, lead, as = "h2" }: { eyebrow: string; title: string; lead?: string; as?: "h1" | "h2" }) {
  const H = as;
  return (
    <div className="text-center max-w-[720px] mx-auto mb-12">
      <Eyebrow>{eyebrow}</Eyebrow>
      <H className={`${as === "h1" ? "text-[clamp(2.1rem,4.4vw,3.2rem)] font-extrabold" : "text-[clamp(1.7rem,3vw,2.4rem)] font-bold"} leading-tight tracking-tight rtl:tracking-normal`}>{title}</H>
      {lead && <p className={`mt-4 text-slate-600 ${as === "h1" ? "text-[1.15rem]" : "text-[1.05rem]"}`}>{lead}</p>}
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span dir="ltr" className={`font-extrabold tracking-tight ${className}`}>Denti<span className="v2-grad-text">Care</span>App</span>;
}

export function Check() {
  return <span className="v2-brand font-extrabold shrink-0">✓</span>;
}
