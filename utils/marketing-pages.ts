// Public SEO pages served by app/[locale]/[slug]. Texts live in the
// "marketing.pages.<key>" message namespace (fr/en/ar). The first entry is the
// pillar page; "faq" renders as a question list with FAQPage structured data.
export type MarketingPage = { key: string; slug: string; icon: string };

export const MARKETING_PAGES: MarketingPage[] = [
  { key: "software", slug: "logiciel-cabinet-dentaire", icon: "🦷" },
  { key: "appointments", slug: "rendez-vous-cabinet-dentaire", icon: "📅" },
  { key: "chart", slug: "schema-dentaire", icon: "🗺️" },
  { key: "claims", slug: "feuille-de-soins-cnops-cnss", icon: "📄" },
  { key: "billing", slug: "facturation-cabinet-dentaire", icon: "🧾" },
  { key: "faq", slug: "faq", icon: "❓" },
];

export const FEATURE_PAGES = MARKETING_PAGES.filter((p) => p.key !== "faq");

export function findMarketingPage(slug: string): MarketingPage | undefined {
  return MARKETING_PAGES.find((p) => p.slug === slug);
}
