import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  if (token_hash && type) {
    // Email confirmation flow (token_hash + type)
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const shopName = user?.user_metadata?.shop_name as string | undefined;
      if (user && shopName) {
        await fetch(`${origin}/api/notify-signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, shopName }),
        }).catch(console.error);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  if (code) {
    // Password reset / OAuth flow (PKCE code)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=confirmation_failed`);
}
