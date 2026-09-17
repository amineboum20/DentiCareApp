import { NextResponse } from "next/server";
import { getAdminUser } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendSupportMail } from "@/utils/support-mail";
import { extractFiles, validateFiles, storeAttachments } from "@/utils/support-attachments";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://denticareapp.com";

// An admin replies on a ticket (service role, bypasses RLS) and the requester is
// notified by email.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: ticket } = await db
    .from("support_tickets")
    .select("id, subject, practice_id, created_by")
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
    .insert({ ticket_id: id, author_id: admin.id, author_role: "admin", body: message })
    .select("id")
    .single();
  if (mErr || !msg) {
    console.error("admin support reply: insert error", mErr?.message);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  const mailAttachments = files.length
    ? await storeAttachments(db, files, ticket.practice_id, id, msg.id)
    : [];

  // Notify the requester by email (look up their address via the auth admin API).
  let requesterEmail: string | null = null;
  if (ticket.created_by) {
    const { data: u } = await db.auth.admin.getUserById(ticket.created_by);
    requesterEmail = u.user?.email ?? null;
  }
  const { data: practice } = await db.from("practices").select("name").eq("id", ticket.practice_id).maybeSingle();

  if (requesterEmail) {
    await sendSupportMail({
      to: [requesterEmail],
      replyTo: admin.email,
      subject: `[Support] ${ticket.subject || "réponse à votre demande"}`,
      heading: "Réponse de l'équipe support",
      rows: [
        { label: "Cabinet", value: practice?.name ?? "—" },
        { label: "Ticket", value: ticket.subject || "—" },
      ],
      body: message,
      ctaLabel: "Voir la réponse",
      ctaUrl: `${APP_URL}/fr/dashboard/support/${id}`,
      attachments: mailAttachments,
    });
  }

  return NextResponse.json({ ok: true });
}
