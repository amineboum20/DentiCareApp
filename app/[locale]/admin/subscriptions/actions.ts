"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { adminEmails, getAdminUser } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { PAYMENT_METHODS } from "@/utils/subscription";
import { archivePractice } from "@/utils/practice-archive";

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Non autorisé");
  return createAdminClient();
}

async function adminEmail() {
  return (await getAdminUser())?.email ?? "admin";
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

// Permanently delete a practice: archive everything first (utils/practice-archive),
// then the data (one atomic SQL function), its storage files and the member
// accounts that belong to no other practice.
// Admin accounts are never deleted. The exact name must be retyped.
export async function deletePracticePermanently(formData: FormData) {
  const db = await requireAdmin();
  const practiceId = String(formData.get("practice_id") ?? "");
  const typed = String(formData.get("confirm_name") ?? "").trim();
  const { data: practice } = await db.from("practices").select("name").eq("id", practiceId).single();
  if (!practice) throw new Error("Introuvable");
  const expected = (practice.name ?? "").trim() || "SUPPRIMER";
  if (typed !== expected) throw new Error("Confirmation incorrecte");

  // 1. Full archive (data + accounts + files) — throws, so nothing is deleted if it fails.
  await archivePractice(db, practiceId, practice.name ?? "", await adminEmail());

  // 2. Delete.
  const { data, error } = await db.rpc("admin_delete_practice", { p_practice_id: practiceId, p_execute: true });
  if (error) throw new Error(error.message);
  const result = data as { objects: { bucket: string; name: string }[]; users: string[] };

  // Storage files, grouped per bucket (the Storage API removes up to 1000 at once).
  const byBucket = new Map<string, string[]>();
  for (const o of result.objects ?? []) byBucket.set(o.bucket, [...(byBucket.get(o.bucket) ?? []), o.name]);
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 500) {
      const { error: e } = await db.storage.from(bucket).remove(names.slice(i, i + 500));
      if (e) console.error("storage remove", bucket, e.message);
    }
  }

  // Auth accounts (email becomes reusable) — never an admin account.
  const admins = adminEmails();
  for (const uid of result.users ?? []) {
    const { data: u } = await db.auth.admin.getUserById(uid);
    if (u?.user?.email && admins.includes(u.user.email.toLowerCase())) continue;
    const { error: e } = await db.auth.admin.deleteUser(uid);
    if (e) console.error("deleteUser", uid, e.message);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/subscriptions");
  const locale = await getLocale();
  redirect(`/${locale}/admin/subscriptions?deleted=${encodeURIComponent(expected)}`);
}
