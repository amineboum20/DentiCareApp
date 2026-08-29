import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // After email confirmation (not password reset), trigger the approval notification
      if (!next.includes("reset-password")) {
        const { data: { user } } = await supabase.auth.getUser();
        const shopName = user?.user_metadata?.shop_name as string | undefined;
        if (user && shopName) {
          await fetch(`${origin}/api/notify-signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email, shopName }),
          }).catch(console.error);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=confirmation_failed`);
}
