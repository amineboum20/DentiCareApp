import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/track/") || pathname === '/docs' || pathname === '/tests' || pathname === '/infra') {
    return NextResponse.next({ request });
  }

  const isDashboard = /^\/(en|fr|ar)\/dashboard/.test(pathname) || pathname.startsWith("/dashboard");

  if (!isDashboard) {
    return intlMiddleware(request);
  }

  // Dashboard: run intlMiddleware first (sets x-next-intl-locale header), then check auth
  const intlResponse = intlMiddleware(request);

  // If intlMiddleware is redirecting (locale normalization), skip auth — it re-runs on the destination
  if ([301, 302, 307, 308].includes(intlResponse.status)) {
    return intlResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            intlResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const localeMatch = pathname.match(/^\/(en|fr|ar)/);
    const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/signin`;
    return NextResponse.redirect(url);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
