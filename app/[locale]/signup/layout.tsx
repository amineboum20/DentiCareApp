import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localeAlternates, openGraphFor } from "@/utils/seo";

// The page itself is a client component, so its metadata lives here.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return {
    title: t("signup.title"),
    description: t("signup.description"),
    alternates: localeAlternates(locale, "/signup"),
    openGraph: openGraphFor(locale, "/signup", t("signup.title"), t("signup.description")),
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
