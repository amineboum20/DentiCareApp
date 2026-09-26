import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import ThemeSync from "@/components/ThemeSync";
import { APP_NAME, SEO_BASE_URL, localeAlternates, openGraphFor } from "@/utils/seo";
import "../globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return {
    metadataBase: new URL(SEO_BASE_URL),
    title: { default: t("home.title"), template: `%s | ${APP_NAME}` },
    description: t("home.description"),
    applicationName: APP_NAME,
    alternates: localeAlternates(locale),
    openGraph: openGraphFor(locale, "", t("home.title"), t("home.description")),
    twitter: { card: "summary_large_image" },
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    },
  };
}

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
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  // Structured data for Google (publisher + the software product and its price).
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SEO_BASE_URL}/#org`,
        name: "MediCareApp",
        url: SEO_BASE_URL,
        logo: `${SEO_BASE_URL}/logo.svg`,
        sameAs: ["https://www.instagram.com/denticareapp", "https://www.facebook.com/denticareapp"],
      },
      {
        "@type": "SoftwareApplication",
        name: APP_NAME,
        url: `${SEO_BASE_URL}/${locale}`,
        description: tSeo("appDescription"),
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: locale,
        publisher: { "@id": `${SEO_BASE_URL}/#org` },
        offers: { "@type": "Offer", price: "199", priceCurrency: "MAD" },
      },
    ],
  };

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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <ThemeSync />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
