"use client";

// Which praticien this account is (drives "my agenda" and the default dentist).
// Moved here from Paramètres: it is about the person, not the cabinet.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setMyPraticien } from "../settings/actions";

export default function MyPraticienCard({ praticiens, initial }: { praticiens: { id: string; name: string }[]; initial: string | null }) {
  const t = useTranslations("settings");
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    setValue(v);
    setSaved(false);
    try { await setMyPraticien(v || null); setSaved(true); setTimeout(() => setSaved(false), 2500); } catch { /* select reflects the attempt */ }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{t("myPractitioner")}</h2>
      <p className="text-xs text-zinc-400 mb-4">{t("myPractitionerHint")}</p>
      <select value={value} onChange={onChange}
        className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
        <option value="">{t("myPractitionerNone")}</option>
        {praticiens.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {saved && <p className="text-xs text-teal-600 mt-2">{t("myPractitionerSaved")}</p>}
    </div>
  );
}
