"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Contact() {
  const t = useTranslations("contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) throw new Error("failed");
      setSent(true);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
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
          <Link href="/signin" className="text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">{t("signIn")}</Link>
        </div>
      </nav>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 v2-shadow p-8">
            {sent ? (
              <div className="text-center">
                <span className="text-5xl">✅</span>
                <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">{t("successTitle")}</h1>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{t("successDesc")}</p>
                <Link href="/" className="mt-6 inline-block text-sm text-teal-600 font-medium hover:underline">{t("backHome")}</Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
                </div>

                {error && (
                  <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("name")}</label>
                    <input type="text" placeholder={t("namePlaceholder")} value={name}
                      onChange={e => setName(e.target.value)} required
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("email")}</label>
                    <input type="email" placeholder={t("emailPlaceholder")} value={email}
                      onChange={e => setEmail(e.target.value)} required
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("subject")}</label>
                    <input type="text" placeholder={t("subjectPlaceholder")} value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("message")}</label>
                    <textarea placeholder={t("messagePlaceholder")} value={message} rows={5}
                      onChange={e => setMessage(e.target.value)} required
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition resize-y" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full py-2.5 rounded-xl v2-grad text-white font-semibold text-sm hover:opacity-95 transition mt-1 disabled:opacity-60 disabled:cursor-not-allowed">
                    {loading ? t("sending") : t("button")}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
