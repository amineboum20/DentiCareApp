"use client";

// Paramètres → Abonnement (owner only): the plan, the trial / status, the
// current balance and the monthly CareApp Group invoices to download. Read-only —
// billing is managed by the CareApp Group admins (RLS: owners can only read).

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import SubscriptionInvoiceButton from "@/components/SubscriptionInvoiceButton";
import {
  currentBalance, effectiveStatus, fmtDay, fmtMoney, monthLabel,
  type SubscriptionInvoiceRow, type SubscriptionPaymentRow, type SubscriptionRow,
} from "@/utils/subscription";

export default function SubscriptionSection({ practiceName, practiceAddress, practicePhone }: {
  practiceName: string; practiceAddress: string | null; practicePhone: string | null;
}) {
  const t = useTranslations("subscription");
  const locale = useLocale();
  const intl = locale === "ar" ? "ar" : locale === "en" ? "en" : "fr";
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<{ sub: SubscriptionRow | null; invoices: SubscriptionInvoiceRow[]; payments: SubscriptionPaymentRow[] } | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("subscriptions").select("*").maybeSingle(),
      supabase.from("subscription_invoices").select("*").order("period_start", { ascending: false }),
      supabase.from("subscription_payments").select("*").order("paid_at", { ascending: false }),
    ]).then(([s, i, p]) => setData({
      sub: (s.data ?? null) as SubscriptionRow | null,
      invoices: (i.data ?? []) as SubscriptionInvoiceRow[],
      payments: (p.data ?? []) as SubscriptionPaymentRow[],
    }));
  }, [supabase]);

  const card = "bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6";
  if (!data) return <div className={`${card} h-40 animate-pulse`} />;
  if (!data.sub) return null;

  const { sub, invoices, payments } = data;
  const status = effectiveStatus(sub);
  const balance = currentBalance(invoices, payments);

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t("title")}</h2>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
            {t("planStandard")} · {t("perMonth", { price: fmtMoney(sub.monthly_price, sub.currency) })}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {status === "trial" ? `🎁 ${t("trialUntil", { date: fmtDay(sub.trial_ends_at, intl) })}`
              : status === "cancelled" ? t("cancelled")
              : t("active")}
          </p>
        </div>
        <div className="text-end">
          <p className="text-xs text-zinc-400">{t("balance")}</p>
          <p className={`text-lg font-bold ${balance > 0 ? "text-red-600 dark:text-red-400" : balance < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"}`}>
            {balance > 0 ? t("due", { amount: fmtMoney(balance, sub.currency) })
              : balance < 0 ? t("credit", { amount: fmtMoney(-balance, sub.currency) })
              : t("upToDate")}
          </p>
        </div>
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">{t("invoices")}</h3>
      {invoices.length === 0 ? (
        <p className="text-sm text-zinc-400">{status === "trial" ? t("noInvoicesTrial", { date: fmtDay(sub.trial_ends_at, intl) }) : t("noInvoices")}</p>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white capitalize">{monthLabel(inv.period_start, intl)}</p>
                <p className="text-xs text-zinc-400 font-mono">{inv.number}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {Number(inv.total_due) < 0 ? t("credit", { amount: fmtMoney(-inv.total_due, inv.currency) }) : t("totalDue", { amount: fmtMoney(inv.total_due, inv.currency) })}
                </span>
                <SubscriptionInvoiceButton invoice={inv} practiceName={practiceName} practiceAddress={practiceAddress} practicePhone={practicePhone} label={t("download")} />
              </div>
            </div>
          ))}
        </div>
      )}

      {payments.length > 0 && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mt-5 mb-2">{t("payments")}</h3>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{fmtDay(p.paid_at, intl)} · {t(`methods.${p.method}`)}</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmtMoney(p.amount, sub.currency)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
