import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

// Canonical public origin for SEO (sitemap, canonical/hreflang, Open Graph).
// The apex domain 308-redirects here, so always advertise the www host.
export const SEO_BASE_URL = "https://www.denticareapp.com";
export const APP_NAME = "DentiCareApp";

const OG_LOCALES: Record<string, string> = { fr: "fr_FR", en: "en_US", ar: "ar_MA" };

/** Canonical + hreflang links for a public page; `path` is locale-less ("" = home). */
export function localeAlternates(locale: string, path = ""): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `/${l}${path}`;
  languages["x-default"] = `/${routing.defaultLocale}${path}`;
  return { canonical: `/${locale}${path}`, languages };
}

/** Full Open Graph block (a child's openGraph replaces the parent's, so always pass all fields). */
export function openGraphFor(locale: string, path: string, title: string, description?: string): Metadata["openGraph"] {
  return {
    type: "website",
    siteName: APP_NAME,
    url: `/${locale}${path}`,
    locale: OG_LOCALES[locale] ?? OG_LOCALES.fr,
    title,
    ...(description ? { description } : {}),
    images: [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630, type: "image/png" }],
  };
}

/** Private / utility pages: keep them out of search results. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };
