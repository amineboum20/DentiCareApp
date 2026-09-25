"use client";

// "Liste | Agenda" switch shown in the Rendez-vous page header. The agenda is
// a view of the appointments, so it lives here rather than in the sidebar.

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export default function AppointmentsViewSwitch() {
  const t = useTranslations("appointments");
  const pathname = usePathname();
  const agenda = pathname.startsWith("/dashboard/agenda");
  const cls = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${active
      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`;
  return (
    <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
      <Link href="/dashboard/appointments" className={cls(!agenda)} aria-current={!agenda ? "page" : undefined}>📋 {t("viewList")}</Link>
      <Link href="/dashboard/agenda" className={cls(agenda)} aria-current={agenda ? "page" : undefined}>📅 {t("viewAgenda")}</Link>
    </div>
  );
}
