"use client";

// In-dashboard error page for a URL the user can't open: 403 (the member's role
// may not access it) or 404 (unknown route / record not found). Rendered inside
// the dashboard layout, so the sidebar stays and the user is never lost.

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function AccessError({ code }: { code: 403 | 404 }) {
  const t = useTranslations("accessError");
  const forbidden = code === 403;
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8 text-center">
        <span className="text-5xl">{forbidden ? "🚫" : "🔍"}</span>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">{t("code", { code })}</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{t(forbidden ? "forbiddenTitle" : "notFoundTitle")}</h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{t(forbidden ? "forbiddenBody" : "notFoundBody")}</p>
        <Link href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
          ← {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
