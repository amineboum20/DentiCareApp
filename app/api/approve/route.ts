import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

const BRAND = "#0d9488";

// Small branded result page. charset=utf-8 is required or accented French +
// emoji render as mojibake (â€¦ / approuvÃ©).
function page(opts: { emoji: string; title: string; body: string; accent?: string }, status = 200) {
  const accent = opts.accent ?? BRAND;
  return new NextResponse(
    `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DentiCare</title>
</head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;">
    <div style="background:#fff;border:1px solid #e4e4e7;border-radius:16px;box-shadow:0 8px 32px rgba(24,24,27,.08);max-width:420px;width:100%;padding:40px 32px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:24px;">
        <span style="font-size:22px;">🦷</span>
        <span style="font-size:18px;font-weight:700;letter-spacing:-.02em;color:#18181b;">DentiCare</span>
      </div>
      <div style="width:64px;height:64px;border-radius:9999px;background:${accent}14;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:32px;">${opts.emoji}</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">${opts.title}</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#71717a;">${opts.body}</p>
    </div>
  </div>
</body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const practiceId = searchParams.get("practice_id");
  const token = searchParams.get("token");

  if (!practiceId || !token) {
    return page({ emoji: "⚠️", title: "Lien invalide", body: "Ce lien d'approbation est incomplet.", accent: "#dc2626" }, 400);
  }

  const secret = process.env.APPROVAL_SECRET!;
  const expected = createHmac("sha256", secret).update(practiceId).digest("hex");
  if (token !== expected) {
    return page({ emoji: "⚠️", title: "Lien invalide ou expiré", body: "Ce lien d'approbation n'est pas valide.", accent: "#dc2626" }, 403);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("practices")
    .update({ is_approved: true })
    .eq("id", practiceId);

  if (error) {
    return page({ emoji: "❌", title: "Une erreur est survenue", body: "L'approbation n'a pas pu être enregistrée. Réessayez dans un instant.", accent: "#dc2626" }, 500);
  }

  return page({
    emoji: "✅",
    title: "Cabinet approuvé",
    body: "L'accès au tableau de bord est maintenant activé. Vous pouvez fermer cette page.",
  });
}
