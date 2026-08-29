import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

export async function POST(request: Request) {
  const { email, shopName } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find the auth user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get or create the practice + member
  let practiceId: string;

  const { data: existingMember } = await supabase
    .from("practice_members")
    .select("practice_id")
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    practiceId = existingMember.practice_id;
  } else {
    const { data: practice, error: practiceError } = await supabase
      .from("practices")
      .insert({ name: shopName, is_approved: false })
      .select("id")
      .single();

    if (practiceError || !practice) {
      console.error("practice insert error:", practiceError);
      return NextResponse.json({ error: "Failed to create practice", details: practiceError }, { status: 500 });
    }

    practiceId = practice.id;

    const firstName = (user.user_metadata?.first_name ?? "") as string;
    const lastName = (user.user_metadata?.last_name ?? "") as string;

    const { error: memberError } = await supabase.from("practice_members").insert({
      user_id: user.id,
      practice_id: practiceId,
      role: "owner",
      first_name: firstName,
      last_name: lastName,
    });

    if (memberError) {
      console.error("member insert error:", memberError);
      return NextResponse.json({ error: "Failed to create member", details: memberError }, { status: 500 });
    }
  }

  // Send notification email
  const secret = process.env.APPROVAL_SECRET!;
  const token = createHmac("sha256", secret).update(practiceId).digest("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://denticareapp.com";
  const approveUrl = `${appUrl}/api/approve?practice_id=${practiceId}&token=${token}`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "DentiCare <noreply@denticareapp.com>",
      to: ["amine@opticareapp.com", "yasmine@opticareapp.com"],
      subject: `Nouvelle inscription DentiCare — ${shopName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <span style="font-size:24px;">🦷</span>
          <strong style="font-size:18px;margin-left:8px;">DentiCare</strong>
          <h2 style="margin-top:24px;">Nouvelle inscription en attente</h2>
          <p><strong>Cabinet :</strong> ${shopName}</p>
          <p><strong>Email :</strong> ${email}</p>
          <p style="margin-top:24px;">
            <a href="${approveUrl}"
               style="background:#0d9488;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
              ✅ Approuver ce cabinet
            </a>
          </p>
          <p style="color:#a1a1aa;font-size:13px;margin-top:24px;">Ce lien approuve immédiatement l'accès au tableau de bord.</p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const emailError = await emailRes.text();
    console.error("Resend error:", emailError);
    return NextResponse.json({ error: "Failed to send email", details: emailError }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
