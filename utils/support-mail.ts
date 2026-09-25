// Branded Resend email for the support ticketing flow (DentiCareApp).
const FROM = "DentiCareApp <noreply@denticareapp.com>";
const ADMINS = ["amine@denticareapp.com", "yasmine@denticareapp.com"];
const ACCENT = "#0d9488";
const BRAND = "DentiCareApp";
const EMOJI = "🦷";

export const SUPPORT_ADMINS = ADMINS;

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface SupportMail {
  to: string[];
  replyTo?: string | null;
  subject: string;
  heading: string;
  rows: { label: string; value: string }[];
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  attachments?: { filename: string; content: string }[];
}

export async function sendSupportMail(mail: SupportMail): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.error("support-mail: RESEND_API_KEY missing");
    return false;
  }
  const rowsHtml = mail.rows
    .map(
      (r, i) =>
        `<tr><td style="padding:${i === 0 ? "12px" : "0"} 16px ${i === mail.rows.length - 1 ? "12px" : "12px"};font-size:13px;color:#71717a;">${esc(r.label)}</td><td style="padding:${i === 0 ? "12px" : "0"} 16px 12px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${esc(r.value)}</td></tr>`
    )
    .join("");
  const bodyHtml = mail.body
    ? `<tr><td style="padding:20px 32px 0;"><p style="margin:0;font-size:14px;line-height:1.65;color:#3f3f46;white-space:pre-wrap;">${esc(mail.body)}</p></td></tr>`
    : "";
  const ctaHtml = mail.ctaUrl
    ? `<tr><td style="padding:22px 32px 0;"><a href="${esc(mail.ctaUrl)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 26px;border-radius:10px;">${esc(mail.ctaLabel ?? "Ouvrir")}</a></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
<tr><td style="height:4px;background:${ACCENT};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 0;">
<span style="font-size:20px;vertical-align:middle;">${EMOJI}</span>
<span style="font-size:17px;font-weight:700;color:#18181b;vertical-align:middle;margin-left:6px;">${BRAND} · Support</span>
</td></tr>
<tr><td style="padding:22px 32px 0;"><h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b;">${esc(mail.heading)}</h1></td></tr>
<tr><td style="padding:16px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f1f1f3;border-radius:10px;">${rowsHtml}</table>
</td></tr>
${bodyHtml}
${ctaHtml}
<tr><td style="padding:22px 32px;border-top:1px solid #f1f1f3;background:#fafafa;margin-top:16px;"><p style="margin:0;font-size:11px;color:#a1a1aa;">${BRAND} · système de tickets de support</p></td></tr>
</table></td></tr></table></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: mail.to,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      subject: mail.subject,
      html,
      ...(mail.attachments && mail.attachments.length ? { attachments: mail.attachments } : {}),
    }),
  });
  if (!res.ok) {
    console.error("support-mail: Resend error:", await res.text());
    return false;
  }
  return true;
}
