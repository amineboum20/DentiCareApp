"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function SignUp() {
  const t = useTranslations("signUp");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError(t("passwordMismatch")); return; }
    if (password.length < 8) { setError(t("passwordTooShort")); return; }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, shop_name: shopName } },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.session) {
      router.push("/dashboard");
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center px-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-10 max-w-md w-full text-center">
          <span className="text-5xl">📬</span>
          <h2 className="mt-4 text-xl font-bold text-zinc-900 dark:text-white">{t("checkEmail")}</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("checkEmailDesc", { email })}</p>
          <Link href="/signin" className="mt-6 inline-block px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors">
            {t("goToSignIn")}
          </Link>
        </div>
      </div>
    );
  }

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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="firstname" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("firstName")}</label>
                  <input id="firstname" type="text" autoComplete="given-name" placeholder="Karim"
                    value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="lastname" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("lastName")}</label>
                  <input id="lastname" type="text" autoComplete="family-name" placeholder="Benali"
                    value={lastName} onChange={(e) => setLastName(e.target.value)} required
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="shopname" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("shopName")}</label>
                <input id="shopname" type="text" placeholder="Cabinet Dentaire Benali"
                  value={shopName} onChange={(e) => setShopName(e.target.value)} required
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("email")}</label>
                <input id="email" type="email" autoComplete="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("password")}</label>
                <input id="password" type="password" autoComplete="new-password" placeholder={t("passwordPlaceholder")}
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("confirmPassword")}</label>
                <input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg bg-teal-600 text-white font-medium text-sm hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? t("loading") : t("button")}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-400">
            {t("alreadyHaveAccount")}{" "}
            <Link href="/signin" className="text-teal-600 font-medium hover:underline">{t("signInLink")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
