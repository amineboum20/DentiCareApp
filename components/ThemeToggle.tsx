"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/utils/supabase/client";

const LABELS: Record<string, { dark: string; light: string }> = {
  fr: { dark: "Mode sombre", light: "Mode clair" },
  en: { dark: "Dark mode", light: "Light mode" },
  ar: { dark: "الوضع الداكن", light: "الوضع الفاتح" },
};

export default function ThemeToggle() {
  const locale = useLocale();
  const [dark, setDark] = useState(false);
  const labels = LABELS[locale] ?? LABELS.fr;

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    const value = next ? "dark" : "light";
    try { localStorage.setItem("theme", value); } catch {}
    document.cookie = `theme=${value};path=/;max-age=31536000;SameSite=Lax`;
    createClient().auth.updateUser({ data: { theme: value } }).catch(() => {});
  }

  return (
    <button
      onClick={toggle}
      title={dark ? labels.dark : labels.light}
      className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
      <span className="text-base">{dark ? "🌙" : "☀️"}</span>
      <span className="flex-1 text-start">{dark ? labels.dark : labels.light}</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${dark ? "bg-teal-600" : "bg-zinc-200 dark:bg-zinc-700"}`}>
        <span className={`pointer-events-none inline-block h-4 w-4 m-0.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${dark ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
