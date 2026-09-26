import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import MarketingShell from "@/components/marketing/MarketingShell";
import { BTN, BTN_GHOST, BTN_PRIMARY, CARD, CONTAINER, Check, Eyebrow, ICON_TILE } from "@/components/marketing/ui";
import { FEATURE_PAGES, findMarketingPage } from "@/utils/marketing-pages";
import { SEO_BASE_URL, localeAlternates, openGraphFor } from "@/utils/seo";

// Public SEO pages (features + FAQ). Unknown slugs 404.
type Props = { params: Promise<{ locale: string; slug: string }> };
type Block = { icon: string; title: string; text: string };
type Faq = { q: string; a: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = findMarketingPage(slug);
  if (!page) return {};
  const t = await getTranslations({ locale, namespace: `marketing.pages.${page.key}` });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(locale, `/${slug}`),
    openGraph: openGraphFor(locale, `/${slug}`, t("metaTitle"), t("metaDescription")),
  };
}

export default async function MarketingPage({ params }: Props) {
  const { locale, slug } = await params;
  const page = findMarketingPage(slug);
  if (!page) notFound();

  const t = await getTranslations({ locale });
  const k = (key: string) => `marketing.pages.${page.key}.${key}`;
  const isFaq = page.key === "faq";
  const blocks = isFaq ? [] : (t.raw(k("blocks")) as Block[]);
  const benefits = isFaq ? [] : (t.raw(k("benefits")) as string[]);
  const faqs = isFaq ? (t.raw(k("items")) as Faq[]) : [];
  const related = FEATURE_PAGES.filter((p) => p.slug !== slug);

  const url = `${SEO_BASE_URL}/${locale}/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("marketing.common.home"), item: `${SEO_BASE_URL}/${locale}` },
          { "@type": "ListItem", position: 2, name: t(k("navLabel")), item: url },
        ],
      },
      ...(isFaq
        ? [{
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }]
        : []),
    ],
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Hero */}
      <section className="v2-hero-bg pt-8 pb-16 sm:pb-[88px]">
        <div className={CONTAINER}>
          <nav aria-label="breadcrumb" className="text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900">{t("marketing.common.home")}</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-700">{t(k("navLabel"))}</span>
          </nav>
          <div className="mt-12 text-center max-w-[760px] mx-auto">
            <Eyebrow>{page.icon} {t(k("badge"))}</Eyebrow>
            <h1 className="text-[clamp(2.1rem,4.4vw,3.2rem)] font-extrabold leading-tight tracking-tight rtl:tracking-normal">{t(k("h1"))}</h1>
            <p className="mt-5 text-[1.15rem] text-slate-600">{t(k("intro"))}</p>
            {!isFaq && (
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                <Link href="/signup" className={BTN_PRIMARY}>{t("hero.cta")}</Link>
                <Link href="/contact" className={BTN_GHOST}>{t("marketing.common.contact")}</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {isFaq ? (
        /* FAQ */
        <section className="pb-16 sm:pb-[88px]">
          <div className="max-w-[820px] mx-auto px-5 grid gap-3">
            {faqs.map((f) => (
              <details key={f.q} className="group bg-white border border-slate-200 rounded-[18px] px-6 py-5 open:shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[1.05rem]">
                  {f.q}
                  <span className="v2-tint v2-brand w-8 h-8 shrink-0 rounded-full grid place-items-center text-lg transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* Feature blocks */}
          <section className="pb-16 sm:pb-[88px]">
            <div className={`${CONTAINER} grid gap-[22px] sm:grid-cols-2`}>
              {blocks.map((b) => (
                <div key={b.title} className={CARD}>
                  <div className={ICON_TILE}>{b.icon}</div>
                  <h2 className="text-[1.15rem] font-bold">{b.title}</h2>
                  <p className="mt-1.5 text-slate-600">{b.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Benefits */}
          <section className="py-16 sm:py-[88px] bg-[#f5f8fb]">
            <div className="max-w-[640px] mx-auto px-5">
              <div className="v2-grad-border v2-shadow rounded-3xl p-6 sm:p-9">
                <div className="text-center"><Eyebrow>{t(k("badge"))}</Eyebrow></div>
                <h2 className="text-center text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-tight">{t("marketing.common.benefitsTitle")}</h2>
                <ul className="mt-7 grid gap-3">
                  {benefits.map((b) => <li key={b} className="flex gap-2.5"><Check /><span className="text-slate-700">{b}</span></li>)}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Related pages */}
      <section className="py-16 sm:py-[88px]">
        <div className={CONTAINER}>
          <div className="text-center mb-10"><h2 className="text-[clamp(1.5rem,2.6vw,2rem)] font-bold">{t("marketing.common.relatedTitle")}</h2></div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <Link key={p.slug} href={`/${p.slug}`} className="v2-shadow group relative overflow-hidden bg-white border border-slate-200 rounded-[18px] p-6 flex flex-col">
                <span className="v2-grad absolute inset-x-0 top-0 h-[5px]" />
                <div className={ICON_TILE}>{p.icon}</div>
                <p className="font-bold">{t(`marketing.pages.${p.key}.navLabel`)}</p>
                <p className="mt-1 text-sm text-slate-600 flex-1">{t(`marketing.pages.${p.key}.teaser`)}</p>
                <span className="v2-brand mt-4 text-sm font-semibold group-hover:underline">{t("marketing.common.learnMore")}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="v2-grad py-16 sm:py-[88px] text-white text-center">
        <div className="max-w-[720px] mx-auto px-5">
          <h2 className="text-[clamp(1.8rem,3.2vw,2.6rem)] font-bold leading-tight">{isFaq ? t("marketing.common.faqContactTitle") : t("cta.title")}</h2>
          <p className="mt-3 text-[1.1rem] opacity-90">{isFaq ? t("marketing.common.faqContactText") : t("cta.subtitle")}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <Link href="/signup" className={`${BTN} bg-white text-slate-900`}>{t("cta.button")}</Link>
            <Link href="/contact" className={`${BTN} border border-white/40 text-white`}>{t("marketing.common.contact")}</Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
