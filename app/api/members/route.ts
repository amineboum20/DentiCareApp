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
  const redirectTo = `${appUrl}/${lang}/auth/callback?next=/reset-password`;

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

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabase
    .from("practice_members")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (caller?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can remove members" }, { status: 403 });
  }

  const memberId = new URL(req.url).searchParams.get("id");
  if (!memberId) return NextResponse.json({ error: "Missing member id" }, { status: 400 });

  const { data: target } = await supabase
    .from("practice_members")
    .select("user_id, role")
    .eq("id", memberId)
    .single();

  if (target?.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the practice owner" }, { status: 400 });
  }

  await supabase.from("practice_members").delete().eq("id", memberId);

  if (target?.user_id) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(target.user_id);
  }

  return NextResponse.json({ success: true });
}
