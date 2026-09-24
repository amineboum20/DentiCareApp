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

// Manage a member (owners only): deactivate / reactivate, or change their role
// (any role, including owner — a practice can have several owners, and owners
// can manage everyone, other owners included). We deliberately do NOT
// hard-delete: the auth account and everything the member authored
// (patients, factures…) are kept. A deactivated member simply can't sign in.
// Guard rails: an owner can't modify their own membership (so a practice always
// keeps at least one active owner — the caller), and a member still awaiting
// admin approval can't be promoted to owner (owners are not in the admin queue).
const ROLES = ["owner", "dentist", "assistant"] as const;
type Role = (typeof ROLES)[number];

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId, action, role } = await req.json();
  if (action !== "deactivate" && action !== "reactivate" && action !== "setRole") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (action === "setRole" && !ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Checks run with the caller's session (RLS): the target must be visible to
  // them and the caller must own that same practice.
  const { data: targetMember } = await supabase
    .from("practice_members")
    .select("practice_id, user_id, is_approved")
    .eq("id", memberId)
    .single();

  if (!targetMember) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (targetMember.user_id === user.id) return NextResponse.json({ error: "Cannot modify yourself" }, { status: 403 });

  const { data: caller } = await supabase
    .from("practice_members")
    .select("role, deactivated_at")
    .eq("user_id", user.id)
    .eq("practice_id", targetMember.practice_id)
    .single();

  if (caller?.role !== "owner" || caller.deactivated_at) {
    return NextResponse.json({ error: "Only the owner can manage members" }, { status: 403 });
  }
  if (action === "setRole" && role === "owner" && targetMember.is_approved === false) {
    return NextResponse.json({ error: "Member awaiting approval" }, { status: 409 });
  }

  // practice_members has no UPDATE RLS policy, so a session-client update
  // silently changes 0 rows. Write with the service role, scoped to this
  // member of this practice, and confirm a row was actually updated.
  const patch = action === "setRole"
    ? { role }
    : { deactivated_at: action === "deactivate" ? new Date().toISOString() : null };
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("practice_members")
    .update(patch)
    .eq("id", memberId)
    .eq("practice_id", targetMember.practice_id)
    .neq("user_id", user.id)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || updated.length === 0) return NextResponse.json({ error: "Member not updated" }, { status: 409 });
  return NextResponse.json({ success: true });
}
