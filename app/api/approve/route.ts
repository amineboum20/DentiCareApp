import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const practiceId = searchParams.get("practice_id");
  const token = searchParams.get("token");

  if (!practiceId || !token) {
    return new NextResponse("Lien invalide.", { status: 400 });
  }

  const secret = process.env.APPROVAL_SECRET!;
  const expected = createHmac("sha256", secret).update(practiceId).digest("hex");
  if (token !== expected) {
    return new NextResponse("Lien invalide ou expiré.", { status: 403 });
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
    return new NextResponse("Erreur lors de l'approbation.", { status: 500 });
  }

  return new NextResponse(`
    <html><body style="font-family:sans-serif;text-align:center;padding:80px 24px;">
      <span style="font-size:48px;">✅</span>
      <h1 style="margin-top:16px;">Cabinet approuvé !</h1>
      <p style="color:#71717a;">L'utilisateur peut maintenant accéder à son tableau de bord.</p>
    </body></html>
  `, { headers: { "Content-Type": "text/html" } });
}
