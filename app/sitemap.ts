import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SEO_BASE_URL } from "@/utils/seo";

// Public, indexable pages only (locale-less paths).
const PAGES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/signup", priority: 0.8 },
  { path: "/contact", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, priority }) =>
    routing.locales.map((locale) => ({
      url: `${SEO_BASE_URL}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, `${SEO_BASE_URL}/${l}${path}`])),
      },
    })),
  );
}
