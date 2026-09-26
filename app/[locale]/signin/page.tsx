"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PasswordInput from "@/components/PasswordInput";
import { authErrorKey } from "@/utils/auth-errors";
import { readThemePref, writeThemePref } from "@/utils/theme";

export default function SignIn() {
  const t = useTranslations("signIn");
  const ta = useTranslations("authErrors");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // A reused / expired link comes back here with ?error=… — show it translated.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code === "confirmation_failed") {
      setError(ta("confirmLinkExpired"));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [ta]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(ta(authErrorKey(error)));
      setLoading(false);
    } else {
      // Restore this account's saved theme (applied once in the dashboard —
      // the sign-in page itself stays light); an account with none yet adopts
      // this browser's choice.
      const meta = data.user?.user_metadata ?? {};
      if (meta.theme === "dark" || meta.theme === "light") writeThemePref(meta.theme);
      else supabase.auth.updateUser({ data: { theme: readThemePref() } }).catch(() => {});
      const savedLocale = (meta.locale as string | undefined) ?? locale;
      router.push(`/${savedLocale}/dashboard`);
      router.refresh();
    }
  }

  return (
    <div className="v2-font v2-hero-bg min-h-screen bg-white flex flex-col text-slate-900">
      <nav className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4 sm:py-5">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.svg" alt="DentiCareApp" className="w-7 h-7" />
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Denti<span className="v2-grad-text">Care</span>App</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <span className="hidden sm:inline text-sm text-zinc-500">
            {t("noAccount")}{" "}
            <Link href="/signup" className="text-teal-600 font-medium hover:underline">{t("signUpFree")}</Link>
          </span>
        </div>
      </nav>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 v2-shadow p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("email")}</label>
                <input id="email" type="email" autoComplete="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("password")}</label>
                  <Link href="/forgot-password" className="text-xs text-teal-600 hover:underline">{t("forgotPassword")}</Link>
                </div>
                <PasswordInput id="password" autoComplete="current-password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl v2-grad text-white font-semibold text-sm hover:opacity-95 transition mt-1 disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? t("loading") : t("button")}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-400">
            {t("dontHaveAccount")}{" "}
            <Link href="/signup" className="text-teal-600 font-medium hover:underline">{t("signUpLink")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
