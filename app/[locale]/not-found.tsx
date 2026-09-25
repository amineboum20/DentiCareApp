"use client";

// Site-wide 404 (public pages and mistyped URLs). Same card as the dashboard's
// AccessError, plus the app lockup. "Retour à l'accueil" goes to "/", which
// the middleware sends signed-in users on to their dashboard.

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("accessError");
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <nav className="flex items-center px-4 sm:px-8 py-4 sm:py-5">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="DentiCareApp" className="w-7 h-7" />
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Denti<span className="text-teal-500 dark:text-teal-400">Care</span>App</span>
        </Link>
      </nav>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8 text-center">
          <span className="text-5xl">🔍</span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t("code", { code: 404 })}</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{t("notFoundTitle")}</h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{t("siteNotFoundBody")}</p>
          <Link href="/"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
            ← {t("backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
