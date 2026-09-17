import { NextResponse } from "next/server";
import { getAdminUser } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

// An admin closes or reopens a ticket (service role). No email on status change.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const action = body.action;
  if (action !== "close" && action !== "reopen") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const db = createAdminClient();
  const patch = action === "close"
    ? { status: "closed", closed_at: new Date().toISOString(), closed_by: admin.id }
    : { status: "open", closed_at: null, closed_by: null };

  const { error } = await db.from("support_tickets").update(patch).eq("id", id);
  if (error) {
    console.error("admin support close: update error", error.message);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
