"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTransition, type CSSProperties } from "react";
import { createClient } from "@/utils/supabase/client";

// Short codes, no flags: a language is not a country (same style as the
// MediCareApp site). The full name shows as a tooltip / accessible label.
const LANGS = [
  { code: "fr", short: "FR", label: "Français" },
  { code: "en", short: "EN", label: "English" },
  { code: "ar", short: "ع", label: "العربية" },
];

export default function LanguageSwitcher({
  saveToAccount = false,
  activeStyle,
}: {
  saveToAccount?: boolean;
  /** Replaces the flat brand colour of the active language (e.g. a gradient). */
  activeStyle?: CSSProperties;
}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: string) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
    if (saveToAccount) {
      createClient().auth.updateUser({ data: { locale: next } }).catch(() => {});
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 p-0.5">
      {LANGS.map((lang) => (
        <button
          key={lang.code}
          onClick={() => switchLocale(lang.code)}
          disabled={isPending}
          title={lang.label}
          aria-label={lang.label}
          aria-pressed={locale === lang.code}
          style={locale === lang.code ? activeStyle : undefined}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
            locale === lang.code
              ? activeStyle ? "text-white" : "bg-teal-600 text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          {lang.short}
        </button>
      ))}
    </div>
  );
}
