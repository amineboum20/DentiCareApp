import { NextResponse } from "next/server";

const RECIPIENTS = ["amine@denticareapp.com", "yasmine@denticareapp.com"];
const FROM = "DentiCareApp <noreply@denticareapp.com>";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  let body: { name?: string; email?: string; subject?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 200);
  const email = String(body.email ?? "").trim().slice(0, 200);
  const subject = String(body.subject ?? "").trim().slice(0, 200);
  const message = String(body.message ?? "").trim().slice(0, 5000);

  if (!name || !email || !message) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY) {
    console.error("contact: RESEND_API_KEY missing");
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  const heading = subject ? `Contact — ${subject}` : "Nouveau message de contact";
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
<tr><td style="height:4px;background:#0d9488;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 0;">
<span style="font-size:20px;vertical-align:middle;">🦷</span>
<span style="font-size:17px;font-weight:700;color:#18181b;vertical-align:middle;margin-left:6px;">DentiCareApp</span>
</td></tr>
<tr><td style="padding:22px 32px 0;"><h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b;">${esc(heading)}</h1></td></tr>
<tr><td style="padding:16px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f1f1f3;border-radius:10px;">
<tr><td style="padding:12px 16px;font-size:13px;color:#71717a;">Nom</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${esc(name)}</td></tr>
<tr><td style="padding:0 16px 12px;font-size:13px;color:#71717a;">E-mail</td><td style="padding:0 16px 12px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${esc(email)}</td></tr>
</table>
</td></tr>
<tr><td style="padding:20px 32px 0;"><p style="margin:0;font-size:14px;line-height:1.65;color:#3f3f46;white-space:pre-wrap;">${esc(message)}</p></td></tr>
<tr><td style="padding:22px 32px;border-top:1px solid #f1f1f3;background:#fafafa;margin-top:16px;"><p style="margin:0;font-size:11px;color:#a1a1aa;">Envoyé depuis le formulaire de contact de denticareapp.com</p></td></tr>
</table></td></tr></table></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: RECIPIENTS,
      reply_to: email,
      subject: `[Contact] ${subject || name}`,
      html,
    }),
  });

  if (!res.ok) {
    console.error("contact: Resend error:", await res.text());
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
