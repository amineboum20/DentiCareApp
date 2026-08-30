import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

export async function POST(request: Request) {
  const { userId, email, shopName, firstName, lastName } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: member } = await supabase
    .from("practice_members")
    .select("practice_id")
    .eq("user_id", userId)
    .single();

  let practiceId: string;

  if (member) {
    practiceId = member.practice_id;
  } else {
    const { data: practice, error } = await supabase
      .from("practices")
      .insert({ name: shopName, is_approved: false })
      .select("id")
      .single();
    if (error || !practice) {
      console.error("practice insert error:", error);
      return NextResponse.json({ error: "Failed to create practice" }, { status: 500 });
    }
    practiceId = practice.id;
    await supabase.from("practice_members").insert({
      user_id: userId,
      practice_id: practiceId,
      role: "owner",
      first_name: firstName,
      last_name: lastName,
    });
  }

  const token = createHmac("sha256", process.env.APPROVAL_SECRET!).update(practiceId).digest("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://denticareapp.com";
  const approveUrl = `${appUrl}/api/approve?practice_id=${practiceId}&token=${token}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
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
          <p><strong>Nom :</strong> ${firstName} ${lastName}</p>
          <p><strong>Email :</strong> ${email}</p>
          <p style="margin-top:24px;">
            <a href="${approveUrl}" style="background:#0d9488;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
              ✅ Approuver ce cabinet
            </a>
          </p>
          <p style="color:#a1a1aa;font-size:13px;margin-top:24px;">Ce lien approuve immédiatement l'accès au tableau de bord.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) console.error("Resend error:", await res.text());

  return NextResponse.json({ ok: true });
}
