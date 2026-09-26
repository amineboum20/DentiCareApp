"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { CONTAINER, Wordmark } from "@/components/marketing/ui";

const GRADIENT = { backgroundImage: "linear-gradient(135deg, var(--brand), var(--brand-2))" };

// Top bar of the public site. Home-page anchors scroll on the home page and
// bring visitors back to that section from any other page.
export default function MarketingNav() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/#features", label: t("nav.features") },
    { href: "/#how", label: t("nav.howItWorks") },
    { href: "/#pricing", label: t("landingV2.pricing") },
    { href: "/faq", label: t("marketing.common.faq") },
    { href: "/contact", label: t("nav.contact") },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200">
      <div className={`${CONTAINER} h-[68px] flex items-center justify-between gap-4`}>
        <Link href="/" className="inline-flex items-center gap-2.5 shrink-0" dir="ltr">
          <img src="/logo.svg" alt="DentiCareApp" className="w-[34px] h-[34px]" />
          <Wordmark className="text-[1.2rem]" />
        </Link>
        <nav className="hidden xl:flex items-center gap-6 whitespace-nowrap font-medium text-slate-600">
          {links.map((l) => <Link key={l.href} href={l.href} className="hover:text-slate-900">{l.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <LanguageSwitcher activeStyle={GRADIENT} />
          <Link href="/signin" className="hidden xl:inline-flex px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">{t("nav.signIn")}</Link>
          <Link href="/signup" className="v2-grad hidden sm:inline-flex px-4 py-2 rounded-xl text-sm font-semibold text-white">{t("nav.getStarted")}</Link>
          <button onClick={() => setOpen(!open)} aria-label="Menu" className="xl:hidden w-9 h-9 rounded-[10px] border border-slate-200 bg-white">☰</button>
        </div>
      </div>
      {open && (
        <nav className="xl:hidden border-t border-slate-200 bg-white px-5 pb-4 flex flex-col font-medium text-slate-700">
          {links.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-3">{l.label}</Link>)}
          <Link href="/signin" onClick={() => setOpen(false)} className="py-3">{t("nav.signIn")}</Link>
          <Link href="/signup" className="v2-grad mt-2 py-3 rounded-xl text-center font-semibold text-white">{t("nav.getStarted")}</Link>
        </nav>
      )}
    </header>
  );
}
