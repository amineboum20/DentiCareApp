import { NextResponse } from "next/server";
import { getAdminUser } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

function displayName(email: string): string {
  const local = (email.split("@")[0] || "Admin").replace(/[._-]+/g, " ").trim();
  return local.replace(/\b\w/g, (c) => c.toUpperCase()) || "Admin";
}

// Upsert one QA test result (or clear it). Admin-only, service role.
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { testId?: string; result?: string | null; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }

  const testId = String(body.testId ?? "").trim();
  if (!testId) return NextResponse.json({ error: "missing" }, { status: 400 });

  const db = createAdminClient();

  // result === null clears the result (row deleted).
  if (body.result === null) {
    await db.from("qa_test_results").delete().eq("test_id", testId);
    return NextResponse.json({ ok: true });
  }

  const result = String(body.result ?? "");
  if (!["pass", "fail", "skip"].includes(result)) {
    return NextResponse.json({ error: "invalid_result" }, { status: 400 });
  }

  const { error } = await db.from("qa_test_results").upsert({
    test_id: testId,
    result,
    note: typeof body.note === "string" ? body.note.slice(0, 2000) : null,
    updated_by: displayName(admin.email ?? ""),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("qa upsert error:", error.message);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
