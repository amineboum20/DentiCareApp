import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localeAlternates, NO_INDEX, openGraphFor } from "@/utils/seo";

// The page itself is a client component, so its metadata lives here.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return {
    title: t("forgotPassword.title"),
    alternates: localeAlternates(locale, "/forgot-password"),
    robots: NO_INDEX,
    openGraph: openGraphFor(locale, "/forgot-password", t("forgotPassword.title")),
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
