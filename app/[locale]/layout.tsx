import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import ThemeSync from "@/components/ThemeSync";
import "../globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "DentiCareApp",
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

  return (
    <html
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
      className={`${geist.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Before paint: public pages always light; /dashboard and /admin use the
            saved choice (utils/theme.ts — keep the path regex in sync). */}
        <script dangerouslySetInnerHTML={{ __html: String.raw`try{var t;try{t=localStorage.getItem("theme")}catch(e){}if(t==null)t=(document.cookie.match(/(?:^|;\s*)theme=([^;]*)/)||[])[1];t=t==="dark"?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark"&&/^\/(en|fr|ar)\/(dashboard|admin)(\/|$)/.test(location.pathname));document.cookie="theme="+t+";path=/;max-age=31536000;SameSite=Lax"}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeSync />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
