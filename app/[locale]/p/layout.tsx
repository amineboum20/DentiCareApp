import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NO_INDEX } from "@/utils/seo";

// Patient portal: private, token-gated — never indexed.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return { title: t("portal.title"), robots: NO_INDEX, alternates: { canonical: null } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
