import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

// Called by the reset-password page right after an invited member opened their
// invite link (which confirms their email). That is the moment the member shows
// up in the admin approval queue, so the admins get a "Nouveau membre à
// approuver" email with a one-click approve link — the member counterpart of
// the "Nouvelle inscription" email sent from auth/callback for new signups.
// Sent at most once per member (user_metadata.approval_notified_at).

const ROLE_LABEL: Record<string, string> = { owner: "Propriétaire", dentist: "Dentiste", assistant: "Assistant" };

function esc(v: string) {
  return v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.email_confirmed_at || user.user_metadata?.approval_notified_at) {
    return NextResponse.json({ sent: false });
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("practice_members")
    .select("id, practice_id, role, first_name, last_name")
    .eq("user_id", user.id)
    .neq("role", "owner")
    .eq("is_approved", false)
    .is("deactivated_at", null)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ sent: false });

  const { data: practice } = await admin.from("practices").select("name").eq("id", member.practice_id).maybeSingle();
  const practiceName = (practice?.name as string | undefined) || "—";
  const memberName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || "—";

  const token = createHmac("sha256", process.env.APPROVAL_SECRET!).update(`member:${member.id}`).digest("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://denticareapp.com";
  const approveUrl = `${appUrl}/api/approve?member_id=${member.id}&token=${token}`;

  const row = (label: string, value: string, first = false) =>
    `<tr><td style="padding:${first ? "12px" : "0"} 16px 12px;font-size:13px;color:#71717a;">${label}</td><td style="padding:${first ? "12px" : "0"} 16px 12px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${esc(value)}</td></tr>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "DentiCare <noreply@denticareapp.com>",
      to: ["amine@denticareapp.com", "yasmine@denticareapp.com"],
      subject: `Nouveau membre à approuver — ${memberName} (${practiceName})`,
      html: `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
<tr><td style="height:4px;background:#0d9488;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 0;">
<span style="font-size:20px;vertical-align:middle;">🦷</span>
<span style="font-size:17px;font-weight:700;color:#18181b;vertical-align:middle;margin-left:6px;">DentiCare</span>
</td></tr>
<tr><td style="padding:22px 32px 0;"><h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b;">Nouveau membre à approuver</h1></td></tr>
<tr><td style="padding:10px 32px 0;"><p style="margin:0;font-size:14px;line-height:1.65;color:#52525b;">Un membre invité vient d'activer son compte et attend votre validation.</p></td></tr>
<tr><td style="padding:16px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f1f1f3;border-radius:10px;">
${row("Membre", memberName, true)}
${row("E-mail", user.email ?? "—")}
${row("Rôle", ROLE_LABEL[member.role as string] ?? String(member.role))}
${row("Cabinet", practiceName)}
</table>
</td></tr>
<tr><td style="padding:22px 32px 0;">
<a href="${approveUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">Approuver ce membre</a>
</td></tr>
<tr><td style="padding:16px 32px 26px;"><p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">Ce lien approuve immédiatement l'accès du membre au tableau de bord.</p></td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #f1f1f3;background:#fafafa;"><p style="margin:0;font-size:11px;color:#a1a1aa;">DentiCare · Logiciel de gestion pour cabinet dentaire</p></td></tr>
</table></td></tr></table></body></html>`,
    }),
  });

  if (!res.ok) {
    console.error("Resend error:", await res.text());
    return NextResponse.json({ sent: false }, { status: 502 });
  }
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, approval_notified_at: new Date().toISOString() },
  });
  return NextResponse.json({ sent: true });
}
