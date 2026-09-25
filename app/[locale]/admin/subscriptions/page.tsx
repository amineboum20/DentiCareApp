import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { currentBalance, effectiveStatus, fmtDay, fmtMoney, monthLabel, type SubscriptionRow } from "@/utils/subscription";
import { generateInvoicesNow } from "./actions";

export const dynamic = "force-dynamic";

const UNIT = "cabinet";
const STATUS_LABEL = { trial: "Essai", active: "Actif", cancelled: "Résilié" } as const;
const STATUS_CLASS = {
  trial: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  cancelled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
} as const;

export default async function AdminSubscriptionsPage() {
  const db = createAdminClient();
  const [{ data: subs }, { data: practices }, { data: invoices }, { data: payments }] = await Promise.all([
    db.from("subscriptions").select("*"),
    db.from("practices").select("id, name, is_approved"),
    db.from("subscription_invoices").select("practice_id, amount, number, period_start").order("period_start", { ascending: false }),
    db.from("subscription_payments").select("practice_id, amount"),
  ]);
  const nameOf = new Map((practices ?? []).map((p) => [p.id as string, p]));
  const rows = ((subs ?? []) as SubscriptionRow[]).map((s) => {
    const inv = (invoices ?? []).filter((i) => i.practice_id === s.practice_id);
    const pay = (payments ?? []).filter((p) => p.practice_id === s.practice_id);
    const p = nameOf.get(s.practice_id);
    return { s, name: (p?.name as string) || "(sans nom)", approved: !!p?.is_approved, balance: currentBalance(inv, pay), last: inv[0] ?? null, status: effectiveStatus(s) };
  }).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));

  const owed = rows.reduce((sum, r) => sum + Math.max(0, r.balance), 0);
  const mrr = rows.filter((r) => r.status === "active" && r.approved).reduce((sum, r) => sum + Number(r.s.monthly_price), 0);
  const counts = { trial: rows.filter((r) => r.status === "trial").length, active: rows.filter((r) => r.status === "active").length };

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Abonnements</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Formule Standard · 199 MAD / mois · 3 mois d&apos;essai. Factures générées automatiquement le 1er de chaque mois.</p>
          </div>
          <form action={generateInvoicesNow}>
            <button className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
              ⚙️ Générer les factures du mois
            </button>
          </form>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Abonnés actifs", value: String(counts.active) },
            { label: "En essai", value: String(counts.trial) },
            { label: "Revenu mensuel", value: fmtMoney(mrr) },
            { label: "Reste à encaisser", value: fmtMoney(owed) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
              <p className="text-xs text-zinc-400">{k.label}</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">{k.value}</p>
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-10">Aucun abonnement.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map(({ s, name, approved, balance, last, status }) => (
              <Link key={s.id} href={`/admin/subscriptions/${s.practice_id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-teal-300 dark:hover:border-teal-800 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {name}{!approved && <span className="ms-2 text-xs text-amber-600">({UNIT} non approuvé)</span>}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {status === "trial" ? `Essai jusqu'au ${fmtDay(s.trial_ends_at)}` : last ? `Dernière facture : ${last.number} (${monthLabel(last.period_start)})` : "Aucune facture"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-sm font-semibold ${balance > 0 ? "text-red-600 dark:text-red-400" : balance < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
                    {balance > 0 ? `Doit ${fmtMoney(balance)}` : balance < 0 ? `Crédit ${fmtMoney(-balance)}` : "À jour"}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
