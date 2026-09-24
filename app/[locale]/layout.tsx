import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import "../globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "DentiCare",
  description: "Logiciel de gestion pour cabinet dentaire",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "fr" | "ar")) {
    notFound();
  }

  const messages = await getMessages();
  const isRtl = locale === "ar";
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value;
  const isDark = theme === "dark";

  return (
    <html
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
      className={`${geist.variable} h-full antialiased${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        {/* Light by default. Dark only if the user chose it with the toggle (it writes
            localStorage + cookie); falls back to the cookie when storage is blocked.
            Also rewrites the cookie, clearing any "dark" once auto-set from the OS. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t;try{t=localStorage.getItem("theme")}catch(e){t=(document.cookie.match(/(?:^|;\\s*)theme=([^;]*)/)||[])[1]}var d=t==="dark";document.documentElement.classList.toggle("dark",d);document.cookie="theme="+(d?"dark":"light")+";path=/;max-age=31536000;SameSite=Lax"}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
