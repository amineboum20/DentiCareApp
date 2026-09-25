"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { PAYMENT_METHODS } from "@/utils/subscription";

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Non autorisé");
  return createAdminClient();
}

// Same function pg_cron runs on the 1st — idempotent (one invoice per practice & month).
export async function generateInvoicesNow() {
  const db = await requireAdmin();
  const { error } = await db.rpc("generate_subscription_invoices", { p_month: new Date().toISOString().slice(0, 10) });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/subscriptions");
}

export async function addPayment(formData: FormData) {
  const db = await requireAdmin();
  const practiceId = String(formData.get("practice_id") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  const paidAt = String(formData.get("paid_at") ?? "") || new Date().toISOString().slice(0, 10);
  const method = String(formData.get("method") ?? "virement");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!practiceId || !(amount > 0)) throw new Error("Montant invalide");
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw new Error("Mode de paiement invalide");
  const { error } = await db.from("subscription_payments").insert({ practice_id: practiceId, amount, paid_at: paidAt, method, note });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/subscriptions/${practiceId}`);
  revalidatePath("/admin/subscriptions");
}

export async function deletePayment(formData: FormData) {
  const db = await requireAdmin();
  const id = String(formData.get("payment_id") ?? "");
  const practiceId = String(formData.get("practice_id") ?? "");
  const { error } = await db.from("subscription_payments").delete().eq("id", id).eq("practice_id", practiceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/subscriptions/${practiceId}`);
  revalidatePath("/admin/subscriptions");
}

// Résilier (no more monthly invoices) / réactiver.
export async function setSubscriptionCancelled(formData: FormData) {
  const db = await requireAdmin();
  const practiceId = String(formData.get("practice_id") ?? "");
  const cancel = formData.get("cancel") === "1";
  const { data: sub } = await db.from("subscriptions").select("trial_ends_at").eq("practice_id", practiceId).single();
  if (!sub) throw new Error("Abonnement introuvable");
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await db.from("subscriptions").update(cancel
    ? { status: "cancelled", cancelled_at: new Date().toISOString() }
    : { status: sub.trial_ends_at > today ? "trial" : "active", cancelled_at: null })
    .eq("practice_id", practiceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/subscriptions/${practiceId}`);
  revalidatePath("/admin/subscriptions");
}
