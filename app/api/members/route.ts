import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabase
    .from("practice_members")
    .select("role, practice_id")
    .eq("user_id", user.id)
    .single();

  if (caller?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can add members" }, { status: 403 });
  }

  const { email, firstName, lastName, role, locale } = await req.json();
  if (!email || !firstName || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Invite flow: the member gets an email, clicks it, and sets their own
  // password (which confirms their address) — same shape as a self-signup,
  // but they join the owner's existing practice instead of creating a new one.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://denticareapp.com";
  const lang = typeof locale === "string" && locale ? locale : "fr";
  // Invites use the implicit flow — the verify endpoint returns the session in
  // the URL #fragment, which the server callback can't read. Point straight at
  // the client reset-password page, which consumes the fragment. (Password
  // recovery keeps the PKCE /reset-password/callback route, which reads ?code.)
  const redirectTo = `${appUrl}/${lang}/reset-password`;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { first_name: firstName, last_name: lastName ?? "" },
    redirectTo,
  });

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 400 });

  // Attach to the owner's practice, pending admin approval.
  const { error: insertError } = await admin
    .from("practice_members")
    .insert({
      practice_id: caller.practice_id,
      user_id: invited.user.id,
      role,
      first_name: firstName,
      last_name: lastName ?? "",
      is_approved: false,
    });

  if (insertError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, userId: invited.user.id });
}

// Deactivate / reactivate a member. We deliberately do NOT hard-delete: the
// auth account and everything the member authored (patients, factures…) are
// kept. A deactivated member simply can't sign in (the dashboard blocks them).
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId, action } = await req.json();
  if (action !== "deactivate" && action !== "reactivate") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { data: caller } = await supabase
    .from("practice_members")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (caller?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can manage members" }, { status: 403 });
  }

  const { data: target } = await supabase
    .from("practice_members")
    .select("role")
    .eq("id", memberId)
    .single();

  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "Cannot deactivate the owner" }, { status: 400 });

  const deactivated_at = action === "deactivate" ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("practice_members")
    .update({ deactivated_at })
    .eq("id", memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
