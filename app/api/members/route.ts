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

  // Checks run with the caller's session (RLS): the target must be visible to
  // them, not the owner, and the caller must own that same practice.
  const { data: targetMember } = await supabase
    .from("practice_members")
    .select("practice_id, role")
    .eq("id", memberId)
    .single();

  if (!targetMember) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (targetMember.role === "owner") return NextResponse.json({ error: "Cannot deactivate the owner" }, { status: 403 });

  const { data: caller } = await supabase
    .from("practice_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("practice_id", targetMember.practice_id)
    .single();

  if (caller?.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can manage members" }, { status: 403 });
  }

  // practice_members has no UPDATE RLS policy, so a session-client update
  // silently changes 0 rows. Write with the service role, scoped to this
  // member of this practice, and confirm a row was actually updated.
  const deactivated_at = action === "deactivate" ? new Date().toISOString() : null;
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("practice_members")
    .update({ deactivated_at })
    .eq("id", memberId)
    .eq("practice_id", targetMember.practice_id)
    .neq("role", "owner")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || updated.length === 0) return NextResponse.json({ error: "Member not updated" }, { status: 409 });
  return NextResponse.json({ success: true });
}
