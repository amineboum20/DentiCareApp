import { createClient } from "@/utils/supabase/server";

// Admins are a small fixed allowlist. ADMIN_EMAILS (comma-separated) overrides
// the default pair. Login accounts must exist in Supabase auth with these exact emails.
const DEFAULT_ADMIN_EMAILS = ["amine@denticareapp.com", "yasmine@denticareapp.com"];

export function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ADMIN_EMAILS;
}

// Returns the signed-in user if they are an admin, otherwise null.
export async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return adminEmails().includes(user.email.toLowerCase()) ? user : null;
}
