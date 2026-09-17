import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getMemberWithPractice } from "@/utils/supabase/queries";
import { sendSupportMail, SUPPORT_ADMINS } from "@/utils/support-mail";
import { extractFiles, validateFiles, storeAttachments } from "@/utils/support-attachments";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://denticareapp.com";

// A practice member posts a reply on their own ticket. RLS keeps it scoped.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await getMemberWithPractice();
  if (!result) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { member, user } = result;

  const db = await createClient();
  const { data: ticket } = await db
    .from("support_tickets")
    .select("id, subject")
    .eq("id", id)
    .single();
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const message = String(form.get("message") ?? "").trim().slice(0, 5000);
  if (!message) return NextResponse.json({ error: "missing" }, { status: 400 });

  const files = extractFiles(form);
  const fileError = validateFiles(files);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const { data: msg, error: mErr } = await db
    .from("support_messages")
    .insert({ ticket_id: id, author_id: user.id, author_role: "user", body: message })
    .select("id")
    .single();
  if (mErr || !msg) {
    console.error("support reply: insert error", mErr?.message);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  const mailAttachments = files.length
    ? await storeAttachments(db, files, member.practice_id, id, msg.id)
    : [];

  const requester = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || (user.email ?? "");
  const shop = member.practices?.name ?? "—";
  await sendSupportMail({
    to: SUPPORT_ADMINS,
    replyTo: user.email,
    subject: `[Support] ${shop} — ${ticket.subject || "réponse"}`,
    heading: `Nouvelle réponse — ${ticket.subject || "ticket"}`,
    rows: [
      { label: "Cabinet", value: shop },
      { label: "Demandeur", value: requester },
      { label: "E-mail", value: user.email ?? "" },
    ],
    body: message,
    ctaLabel: "Ouvrir le ticket",
    ctaUrl: `${APP_URL}/fr/admin/support/${id}`,
    attachments: mailAttachments,
  });

  return NextResponse.json({ ok: true });
}
