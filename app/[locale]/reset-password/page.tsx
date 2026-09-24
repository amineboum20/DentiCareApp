"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PasswordInput from "@/components/PasswordInput";
import { authErrorKey } from "@/utils/auth-errors";

export default function ResetPassword() {
  const t = useTranslations("resetPassword");
  const ta = useTranslations("authErrors");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // The invite/recovery callback establishes a session before landing here, so
  // we can read the account it belongs to and pre-fill it read-only.
  const [account, setAccount] = useState<{ email: string; firstName: string; lastName: string } | null>(null);
  // Invite links (member activation) arrive with an implicit-flow #access_token
  // fragment; password recovery arrives via the server callback (cookie, no
  // fragment). That — not the presence of a name — is what tells the two apart.
  const [isInvite, setIsInvite] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // Invite links (implicit flow) deliver the session in the URL #fragment;
      // establish it before reading the user. Recovery (PKCE) already has a
      // cookie session from the server callback, so there's no fragment.
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (hash.includes("access_token")) {
        setIsInvite(true);
        const p = new URLSearchParams(hash.slice(1));
        const access_token = p.get("access_token");
        const refresh_token = p.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (u) {
        setAccount({
          email: u.email ?? "",
          firstName: (u.user_metadata?.first_name as string) ?? "",
          lastName: (u.user_metadata?.last_name as string) ?? "",
        });
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("tooShort"));
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(ta(authErrorKey(error)));
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  const readonlyCls =
    "w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400 cursor-not-allowed";
  const inputCls =
    "w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition";
  const labelCls = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <nav className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4 sm:py-5">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.svg" alt="DentiCare" className="w-7 h-7" />
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Denti<span className="text-teal-500 dark:text-teal-400">Care</span></span>
        </Link>
        <LanguageSwitcher />
      </nav>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{isInvite ? t("inviteTitle") : t("title")}</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{isInvite ? t("inviteSubtitle") : t("subtitle")}</p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {account?.email && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className={labelCls}>{t("email")}</label>
                  <input id="email" type="email" value={account.email} readOnly disabled className={readonlyCls} />
                </div>
              )}

              {isInvite && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="firstName" className={labelCls}>{t("firstName")}</label>
                    <input id="firstName" type="text" value={account?.firstName ?? ""} readOnly disabled className={readonlyCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lastName" className={labelCls}>{t("lastName")}</label>
                    <input id="lastName" type="text" value={account?.lastName ?? ""} readOnly disabled className={readonlyCls} />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className={labelCls}>{t("password")}</label>
                <PasswordInput id="password" autoComplete="new-password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm" className={labelCls}>{t("confirm")}</label>
                <PasswordInput id="confirm" autoComplete="new-password" placeholder="••••••••"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputCls} />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg bg-teal-600 text-white font-medium text-sm hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? t("loading") : isInvite ? t("inviteButton") : t("button")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
