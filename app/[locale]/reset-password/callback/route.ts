import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";

// Dedicated callback for password-recovery and invite links. It mirrors the
// code-exchange in /auth/callback but always lands on the reset-password form.
//
// It must NOT carry a query string in the redirect URL that Supabase emails:
// Supabase validates redirect_to against the Auth "Redirect URLs" allow-list,
// and the `/**` wildcard does not reliably match a URL that has a `?query`, so
// a `.../auth/callback?next=/reset-password` link silently falls back to the
// Site URL (the landing page). A clean path like this one matches `/**`.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  const resetUrl = `${origin}/${locale}/reset-password`;
  const failUrl = `${origin}/${locale}/signin?error=recovery_failed`;

  // Invite links use the token_hash + type (verifyOtp) flow.
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(resetUrl);
  }

  // PKCE recovery links use ?code= (exchange sets the session cookie).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(resetUrl);
  }

  return NextResponse.redirect(failUrl);
}
