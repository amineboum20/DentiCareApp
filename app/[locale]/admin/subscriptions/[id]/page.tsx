import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import SubscriptionInvoiceButton from "@/components/SubscriptionInvoiceButton";
import {
  currentBalance, effectiveStatus, fmtDay, fmtMoney, monthLabel, PAYMENT_METHODS,
  type SubscriptionInvoiceRow, type SubscriptionPaymentRow, type SubscriptionRow,
} from "@/utils/subscription";
import { addPayment, deletePayment, setSubscriptionCancelled } from "../actions";
import DeletePracticeCard from "./DeletePracticeCard";

const FOOTPRINT_LABEL: Record<string, string> = { members: "membres", patients: "patients", consultations: "visites", dossiers: "dossiers", factures: "factures", ordonnances: "ordonnances", appointments: "RDV", actes: "actes", support_tickets: "tickets support", invoices: "factures d'abonnement", files: "fichiers" };

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = { virement: "Virement", especes: "Espèces", cheque: "Chèque", carte: "Carte", autre: "Autre" };
const STATUS_LABEL = { trial: "Essai", active: "Actif", cancelled: "Résilié" } as const;

export default async function AdminSubscriptionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const [{ data: practice }, { data: sub }, { data: invoices }, { data: payments }] = await Promise.all([
    db.from("practices").select("id, name, address, phone, created_at, is_approved").eq("id", id).maybeSingle(),
    db.from("subscriptions").select("*").eq("practice_id", id).maybeSingle(),
    db.from("subscription_invoices").select("*").eq("practice_id", id).order("period_start", { ascending: false }),
    db.from("subscription_payments").select("*").eq("practice_id", id).order("paid_at", { ascending: false }),
  ]);
  if (!practice) notFound();
  // What "Supprimer définitivement" would remove (dry run, nothing is deleted).
  const { data: footprint } = await db.rpc("admin_delete_practice", { p_practice_id: id, p_execute: false });
  const counts = (footprint as { counts?: Record<string, number> } | null)?.counts;
  const summary = counts ? Object.entries(FOOTPRINT_LABEL).map(([k, label]) => ({ label, count: Number(counts[k] ?? 0) })) : null;
  if (!sub) {
    return (
      <div className="p-4 sm:p-8"><div className="max-w-4xl mx-auto space-y-5">
        <Link href="/admin/subscriptions" className="text-sm text-zinc-500 hover:text-blue-600">← Abonnements</Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{practice.name || "(sans nom)"}</h1>
        <DeletePracticeCard practiceId={id} practiceName={practice.name ?? ""} summary={summary} />
      </div></div>
    );
  }
  const s = sub as SubscriptionRow;
  const inv = (invoices ?? []) as SubscriptionInvoiceRow[];
  const pay = (payments ?? []) as SubscriptionPaymentRow[];
  const balance = currentBalance(inv, pay);
  const status = effectiveStatus(s);

  // Timeline: invoices and payments together, newest first.
  const history = [
    ...inv.map((i) => ({ date: i.issued_at, kind: "invoice" as const, i })),
    ...pay.map((p) => ({ date: p.paid_at, kind: "payment" as const, p })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const card = "rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5";
  const input = "px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white";

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <Link href="/admin/subscriptions" className="text-sm text-zinc-500 hover:text-teal-600">← Abonnements</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{practice.name || "(sans nom)"}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Standard · {fmtMoney(s.monthly_price, s.currency)} / mois · {STATUS_LABEL[status]}
              {status === "trial" ? ` jusqu'au ${fmtDay(s.trial_ends_at)}` : ` · essai terminé le ${fmtDay(s.trial_ends_at)}`}
            </p>
          </div>
          <div className="text-end">
            <p className="text-xs text-zinc-400">Solde actuel</p>
            <p className={`text-xl font-bold ${balance > 0 ? "text-red-600 dark:text-red-400" : balance < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"}`}>
              {balance > 0 ? `Doit ${fmtMoney(balance)}` : balance < 0 ? `Crédit ${fmtMoney(-balance)}` : "À jour"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Record a payment */}
          <form action={addPayment} className={card}>
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Enregistrer un paiement</h2>
            <input type="hidden" name="practice_id" value={id} />
            <div className="grid grid-cols-2 gap-3">
              <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Montant (MAD)" className={input} />
              <input name="paid_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={input} />
              <select name="method" defaultValue="virement" className={input}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
              </select>
              <input name="note" placeholder="Note (facultatif)" className={input} />
            </div>
            <p className="text-xs text-zinc-400 mt-3">Un montant supérieur au dû devient un crédit, repris sur les factures suivantes.</p>
            <button className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium">Enregistrer</button>
          </form>

          {/* Subscription status */}
          <div className={card}>
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Abonnement</h2>
            <dl className="text-sm space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between"><dt>Inscription</dt><dd>{fmtDay(practice.created_at)}</dd></div>
              <div className="flex justify-between"><dt>Fin de l&apos;essai</dt><dd>{fmtDay(s.trial_ends_at)}</dd></div>
              <div className="flex justify-between"><dt>Factures</dt><dd>{inv.length}</dd></div>
              <div className="flex justify-between"><dt>Paiements</dt><dd>{pay.length}</dd></div>
              {s.cancelled_at && <div className="flex justify-between"><dt>Résilié le</dt><dd>{fmtDay(s.cancelled_at)}</dd></div>}
            </dl>
            <form action={setSubscriptionCancelled} className="mt-4">
              <input type="hidden" name="practice_id" value={id} />
              <input type="hidden" name="cancel" value={s.status === "cancelled" ? "0" : "1"} />
              <button className={`text-sm font-medium ${s.status === "cancelled" ? "text-emerald-600 hover:text-emerald-700" : "text-red-500 hover:text-red-600"}`}>
                {s.status === "cancelled" ? "Réactiver l'abonnement" : "Résilier (plus de factures mensuelles)"}
              </button>
            </form>
          </div>
        </div>

        {/* History */}
        <div className={card}>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Historique</h2>
          {history.length === 0 ? (
            <p className="text-sm text-zinc-400">Aucune facture ni paiement pour l&apos;instant.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {history.map((h) => h.kind === "invoice" ? (
                <div key={`i${h.i.id}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">🧾 {h.i.number} · {monthLabel(h.i.period_start)}</p>
                    <p className="text-xs text-zinc-400">
                      {fmtDay(h.i.issued_at)} · mensualité {fmtMoney(h.i.amount)} · solde précédent {fmtMoney(h.i.previous_balance)} · {Number(h.i.total_due) < 0 ? `crédit ${fmtMoney(-h.i.total_due)}` : `total ${fmtMoney(h.i.total_due)}`}
                    </p>
                  </div>
                  <SubscriptionInvoiceButton invoice={h.i} practiceName={practice.name ?? ""} practiceAddress={practice.address} practicePhone={practice.phone} label="PDF" />
                </div>
              ) : (
                <div key={`p${h.p.id}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">💰 Paiement {fmtMoney(h.p.amount)} · {METHOD_LABEL[h.p.method] ?? h.p.method}</p>
                    <p className="text-xs text-zinc-400">{fmtDay(h.p.paid_at)}{h.p.note ? ` · ${h.p.note}` : ""}</p>
                  </div>
                  <form action={deletePayment}>
                    <input type="hidden" name="payment_id" value={h.p.id} />
                    <input type="hidden" name="practice_id" value={id} />
                    <button className="text-xs text-zinc-400 hover:text-red-600">Supprimer</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <DeletePracticeCard practiceId={id} practiceName={practice.name ?? ""} summary={summary} />
      </div>
    </div>
  );
}
