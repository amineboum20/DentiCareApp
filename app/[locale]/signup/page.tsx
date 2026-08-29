"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function SignUp() {
  const t = useTranslations("signUp");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <nav className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🦷</span>
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">DentiCare</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <span className="text-sm text-zinc-500">
            {t("alreadyHaveAccount")}{" "}
            <Link href="/signin" className="text-teal-600 font-medium hover:underline">{t("signInLink")}</Link>
          </span>
        </div>
      </nav>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8 text-center">
            <span className="text-5xl">🔒</span>
            <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">
              {t("inviteTitle")}
            </h1>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t("inviteDesc")}
            </p>

            <div className="mt-8 flex flex-col gap-4 text-left">
              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Amine Boumazzough</p>
                <a href="mailto:amine@opticareapp.com" className="flex items-center gap-2 text-sm text-teal-600 hover:underline">
                  <span>✉️</span> amine@opticareapp.com
                </a>
                <a href="tel:+33758800085" dir="ltr" className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 mt-1 hover:underline">
                  <span>📞</span> +33 7 58 80 00 85
                </a>
              </div>

              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Yasmine Boumazzough</p>
                <a href="mailto:yasmine@opticareapp.com" className="flex items-center gap-2 text-sm text-teal-600 hover:underline">
                  <span>✉️</span> yasmine@opticareapp.com
                </a>
                <a href="tel:+33753287982" dir="ltr" className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 mt-1 hover:underline">
                  <span>📞</span> +33 7 53 28 79 82
                </a>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-zinc-400">
              {t("alreadyHaveAccount")}{" "}
              <Link href="/signin" className="text-teal-600 font-medium hover:underline">{t("signInLink")}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
