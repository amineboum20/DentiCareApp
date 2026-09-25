import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

// Update the signed-in user's own first / last name (Mon profil).
// practice_members has no UPDATE RLS policy, so the write goes through the
// service role — strictly scoped to the caller's own row(s). The auth
// user_metadata is kept in sync (used by invite / reset pages).
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const firstName = typeof body.firstName === "string" ? body.firstName.trim().slice(0, 80) : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim().slice(0, 80) : "";
  if (!firstName) return NextResponse.json({ error: "First name required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("practice_members")
    .update({ first_name: firstName, last_name: lastName })
    .eq("user_id", user.id)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || updated.length === 0) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, first_name: firstName, last_name: lastName },
  });
  return NextResponse.json({ success: true });
}
