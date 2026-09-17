import { NextResponse } from "next/server";
import { getMemberWithPractice } from "@/utils/supabase/queries";

const RECIPIENTS = ["amine@denticareapp.com", "yasmine@denticareapp.com"];
const FROM = "DentiCare <noreply@denticareapp.com>";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // 15 MB total across attachments

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  const result = await getMemberWithPractice();
  if (!result) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { member, user } = result;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const subject = String(form.get("subject") ?? "").trim().slice(0, 200);
  const message = String(form.get("message") ?? "").trim().slice(0, 5000);
  if (!message) return NextResponse.json({ error: "missing" }, { status: 400 });

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: "too_many_files" }, { status: 400 });
  }
  let total = 0;
  const attachments: { filename: string; content: string }[] = [];
  for (const file of files) {
    total += file.size;
    if (total > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    attachments.push({ filename: file.name || "piece-jointe", content: buf.toString("base64") });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("support: RESEND_API_KEY missing");
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  const requester = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || (user.email ?? "");
  const shop = member.practices?.name ?? "—";
  const heading = subject ? `Support — ${subject}` : "Nouvelle demande de support";
  const filesLine = attachments.length
    ? `<tr><td style="padding:0 16px 12px;font-size:13px;color:#71717a;">Pièces jointes</td><td style="padding:0 16px 12px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${attachments.length}</td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
<tr><td style="height:4px;background:#0d9488;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 0;">
<span style="font-size:20px;vertical-align:middle;">🦷</span>
<span style="font-size:17px;font-weight:700;color:#18181b;vertical-align:middle;margin-left:6px;">DentiCare · Support</span>
</td></tr>
<tr><td style="padding:22px 32px 0;"><h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b;">${esc(heading)}</h1></td></tr>
<tr><td style="padding:16px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f1f1f3;border-radius:10px;">
<tr><td style="padding:12px 16px;font-size:13px;color:#71717a;">Cabinet</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${esc(shop)}</td></tr>
<tr><td style="padding:0 16px 12px;font-size:13px;color:#71717a;">Demandeur</td><td style="padding:0 16px 12px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${esc(requester)}</td></tr>
<tr><td style="padding:0 16px 12px;font-size:13px;color:#71717a;">E-mail</td><td style="padding:0 16px 12px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${esc(user.email ?? "")}</td></tr>
<tr><td style="padding:0 16px 12px;font-size:13px;color:#71717a;">Rôle</td><td style="padding:0 16px 12px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${esc(member.role ?? "")}</td></tr>
${filesLine}
</table>
</td></tr>
<tr><td style="padding:20px 32px 0;"><p style="margin:0;font-size:14px;line-height:1.65;color:#3f3f46;white-space:pre-wrap;">${esc(message)}</p></td></tr>
<tr><td style="padding:22px 32px;border-top:1px solid #f1f1f3;background:#fafafa;margin-top:16px;"><p style="margin:0;font-size:11px;color:#a1a1aa;">Demande envoyée depuis le tableau de bord DentiCare</p></td></tr>
</table></td></tr></table></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: RECIPIENTS,
      reply_to: user.email,
      subject: `[Support] ${shop} — ${subject || "demande"}`,
      html,
      ...(attachments.length ? { attachments } : {}),
    }),
  });

  if (!res.ok) {
    console.error("support: Resend error:", await res.text());
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
