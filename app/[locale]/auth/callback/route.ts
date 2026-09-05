import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { type EmailOtpType } from "@supabase/supabase-js";

async function notifyApproval(userId: string, email: string, shopName: string, firstName: string, lastName: string) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let practiceId: string;

  const { data: existingMember } = await supabase
    .from("practice_members")
    .select("practice_id")
    .eq("user_id", userId)
    .single();

  if (existingMember) {
    practiceId = existingMember.practice_id;
  } else {
    const { data: practice, error } = await supabase
      .from("practices")
      .insert({ name: shopName, is_approved: false })
      .select("id")
      .single();

    if (error || !practice) { console.error("practice insert error:", error); return; }
    practiceId = practice.id;

    const { error: memberError } = await supabase.from("practice_members").insert({
      user_id: userId,
      practice_id: practiceId,
      role: "owner",
      first_name: firstName,
      last_name: lastName,
    });
    if (memberError) { console.error("member insert error:", memberError); return; }
  }

  const token = createHmac("sha256", process.env.APPROVAL_SECRET!).update(practiceId).digest("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://denticareapp.com";
  const approveUrl = `${appUrl}/api/approve?practice_id=${practiceId}&token=${token}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "DentiCare <noreply@denticareapp.com>",
      to: ["amine@denticareapp.com", "yasmine@denticareapp.com"],
      subject: `Nouvelle inscription DentiCare — ${shopName}`,
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
<tr><td style="padding:22px 32px 0;"><h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b;">Nouvelle inscription en attente</h1></td></tr>
<tr><td style="padding:10px 32px 0;"><p style="margin:0;font-size:14px;line-height:1.65;color:#52525b;">Un nouveau cabinet vient de s'inscrire et attend votre validation.</p></td></tr>
<tr><td style="padding:16px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f1f1f3;border-radius:10px;">
<tr><td style="padding:12px 16px;font-size:13px;color:#71717a;">Cabinet</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${shopName}</td></tr>
<tr><td style="padding:0 16px 12px;font-size:13px;color:#71717a;">E-mail</td><td style="padding:0 16px 12px;font-size:13px;font-weight:600;color:#18181b;text-align:right;">${email}</td></tr>
</table>
</td></tr>
<tr><td style="padding:22px 32px 0;">
<a href="${approveUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">Approuver ce cabinet</a>
</td></tr>
<tr><td style="padding:16px 32px 26px;"><p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">Ce lien approuve immédiatement l'accès au tableau de bord.</p></td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #f1f1f3;background:#fafafa;"><p style="margin:0;font-size:11px;color:#a1a1aa;">DentiCare · Logiciel de gestion pour cabinet dentaire</p></td></tr>
</table></td></tr></table></body></html>`,
    }),
  });

  if (!res.ok) console.error("Resend error:", await res.text());
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error && data.user) {
      const user = data.user;
      // Invited members and password resets have no password yet — send them
      // to the set-password page (next) rather than straight to the dashboard.
      if (type === "invite" || type === "recovery") {
        return NextResponse.redirect(`${origin}${next}`);
      }
      const shopName = user.user_metadata?.shop_name as string | undefined;
      if (shopName) {
        await notifyApproval(
          user.id,
          user.email ?? "",
          shopName,
          user.user_metadata?.first_name ?? "",
          user.user_metadata?.last_name ?? "",
        ).catch(console.error);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=confirmation_failed`);
}
