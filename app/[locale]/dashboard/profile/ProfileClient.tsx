"use client";

// "Mon profil" — everything about the signed-in person (not the cabinet):
// first / last name, email, password, language. Reached by clicking the user
// block at the bottom of the sidebar. The cabinet itself lives in Paramètres.

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/client";
import PasswordInput from "@/components/PasswordInput";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ErrorBanner from "@/components/ErrorBanner";
import { authErrorKey } from "@/utils/auth-errors";
import type { MemberRole } from "@/types/database";

interface Props {
  initialFirstName: string;
  initialLastName: string;
  email: string;
  pendingEmail: string | null;
  role: MemberRole;
  practiceName: string;
  children?: React.ReactNode; // app-specific extra cards (e.g. linked praticien)
}

export default function ProfileClient({ initialFirstName, initialLastName, email, pendingEmail, role, practiceName, children }: Props) {
  const t = useTranslations("profile");
  const ts = useTranslations("settings");
  const ta = useTranslations("authErrors");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Personal info
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);
  const [infoError, setInfoError] = useState("");

  // Email
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailInfo, setEmailInfo] = useState("");

  // Password
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  // Result of the email-change confirmation link (?email=confirmed|partial|link_expired).
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("email");
    if (!code) return;
    if (code === "confirmed") setEmailInfo(t("emailConfirmed"));
    else if (code === "partial") setEmailInfo(t("emailPartial"));
    else setEmailError(t("emailLinkExpired"));
    window.history.replaceState(null, "", window.location.pathname);
  }, [t]);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoError(""); setInfoSaved(false);
    if (!firstName.trim()) { setInfoError(t("firstNameRequired")); return; }
    setInfoSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
    }).catch(() => null);
    setInfoSaving(false);
    if (!res || !res.ok) { setInfoError(t("saveError")); return; }
    setInfoSaved(true); setTimeout(() => setInfoSaved(false), 3000);
    router.refresh(); // sidebar name
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(""); setEmailInfo("");
    const next = newEmail.trim().toLowerCase();
    if (!next) return;
    if (next === email.toLowerCase()) { setEmailError(t("emailSame")); return; }
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/${locale}/auth/email-change` },
    );
    setEmailSaving(false);
    if (error) { setEmailError(ta(authErrorKey(error))); return; }
    setEmailInfo(t("emailSent", { old: email, new: next }));
    setNewEmail("");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPw || newPw !== confirmPw) { setPwError(ts("pwMismatch")); return; }
    if (newPw.length < 8) { setPwError(ts("pwMin")); return; }
    setPwSaving(true); setPwError(""); setPwSuccess("");
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) { setPwError(ta(authErrorKey(error))); return; }
    setNewPw(""); setConfirmPw("");
    setPwSuccess(ts("pwUpdated")); setTimeout(() => setPwSuccess(""), 3000);
  }

  const card = "bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6";
  const h2 = "text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-5";
  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";
  const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5";
  const btn = "px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors";
  const initial = (firstName || email)[0]?.toUpperCase() ?? "?";

  return (
    <div className="space-y-6">
      {/* Identity header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 text-xl font-bold shrink-0">{initial}</div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white truncate">{`${firstName} ${lastName}`.trim() || t("title")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{ts(`roles.${role}`)} · {practiceName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {/* Personal info */}
          <form onSubmit={saveInfo} className={card}>
            <h2 className={h2}>{t("personalInfo")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("firstName")}</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={80} className={inputCls} autoComplete="given-name" />
              </div>
              <div>
                <label className={labelCls}>{t("lastName")}</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={80} className={inputCls} autoComplete="family-name" />
              </div>
            </div>
            <ErrorBanner message={infoError} className="mt-4" />
            <div className="flex items-center gap-3 mt-5">
              <button type="submit" disabled={infoSaving} className={btn}>{infoSaving ? tc("saving") : tc("save")}</button>
              {infoSaved && <span className="text-sm text-emerald-600 dark:text-emerald-400">✓ {tc("saved")}</span>}
            </div>
          </form>

          {/* Email */}
          <form onSubmit={changeEmail} className={card}>
            <h2 className={h2}>{t("emailTitle")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{t("currentEmail")} : <span className="font-medium text-zinc-800 dark:text-zinc-200">{email}</span></p>
            {pendingEmail && !emailInfo && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">⏳ {t("emailPending", { email: pendingEmail })}</p>
            )}
            <label className={labelCls}>{t("newEmail")}</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="vous@exemple.com" className={inputCls} autoComplete="email" required />
            <ErrorBanner message={emailError} className="mt-4" />
            {emailInfo && <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">✓ {emailInfo}</p>}
            <div className="mt-5">
              <button type="submit" disabled={emailSaving} className={btn}>{emailSaving ? tc("saving") : t("changeEmail")}</button>
            </div>
          </form>

          {children}
        </div>

        <div className="space-y-6">
          {/* Password */}
          <form onSubmit={changePassword} className={card}>
            <h2 className={h2}>{ts("changePassword")}</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>{ts("newPasswordLabel")}</label>
                <PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={ts("pwMinPlaceholder")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{ts("confirmPasswordLabel")}</label>
                <PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••" className={inputCls} />
              </div>
              <ErrorBanner message={pwError} />
              <div className="flex items-center gap-3">
                <button type="submit" disabled={pwSaving} className={btn}>{pwSaving ? tc("saving") : ts("changePassword")}</button>
                {pwSuccess && <span className="text-sm text-emerald-600 dark:text-emerald-400">✓ {pwSuccess}</span>}
              </div>
            </div>
          </form>

          {/* Language */}
          <div className={card}>
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">{ts("language")}</h2>
            <LanguageSwitcher saveToAccount />
          </div>
        </div>
      </div>
    </div>
  );
}
