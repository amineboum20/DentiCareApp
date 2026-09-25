import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";

// Landing for the "confirm your new email" links (Mon profil → Changer l'email).
// Secure email change is on: a link goes to BOTH the old and the new address.
// The first one clicked only records its half (no code comes back) → "partial";
// the second completes the change (?code= / token_hash) → "confirmed".
// Clean path, no query string in redirect_to (Supabase allow-list gotcha).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const profile = (result: string) => NextResponse.redirect(`${origin}/${locale}/dashboard/profile?email=${result}`);

  const supabase = await createClient();
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    return profile(error ? "link_expired" : "confirmed");
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return profile(error ? "link_expired" : "confirmed");
  }
  if (searchParams.get("error") || searchParams.get("error_code")) return profile("link_expired");
  return profile("partial");
}
